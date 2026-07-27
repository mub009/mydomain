import { CampaignMessageStatus, CampaignStatus } from "@prisma/client";
import { prisma } from "@/config/database";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { whatsappTransport } from "./transport";
import { isWithinWindow, msUntilWindowOpens } from "./sendingWindow";

/**
 * Sends queued campaign messages, one at a time, with a pause between each.
 *
 * Everything here is deliberately unhurried. WhatsApp is not a bulk channel —
 * a burst of identical messages from one handset is the fastest way to get a
 * shop's number restricted — so the loop sends a single message per tick and
 * waits, using that shop's own configured pace.
 */

const tickState = { running: false, timer: null as NodeJS.Timeout | null };

// How long to wait before looking again when there is nothing to do, or when
// sending is blocked for a reason that will not clear quickly.
const IDLE_DELAY_MS = 15_000;

function withJitter(delayMs: number, jitterMs: number): number {
  return delayMs + Math.floor(Math.random() * (Math.max(0, jitterMs) + 1));
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

async function sentTodayFor(businessId: string): Promise<number> {
  return prisma.campaignMessage.count({
    where: {
      campaign: { businessId },
      status: CampaignMessageStatus.SENT,
      sentAt: { gte: startOfToday() },
    },
  });
}

export interface TickResult {
  outcome: "sent" | "idle" | "blocked";
  /** What the loop should wait before trying again. */
  nextDelayMs: number;
}

/**
 * Handles one message and says how long to wait before the next. Exported so
 * a test can drive the loop deterministically instead of waiting on timers.
 */
export async function sendNextMessage(): Promise<TickResult> {
  const campaign = await prisma.campaign.findFirst({
    where: { status: CampaignStatus.SENDING },
    orderBy: { startedAt: "asc" },
  });
  if (!campaign) return { outcome: "idle", nextDelayMs: IDLE_DELAY_MS };

  // Each shop sets its own pace, cap and quiet hours; env only seeds defaults
  // for a business that has never opened the settings.
  const session = await prisma.whatsappSession.findUnique({ where: { businessId: campaign.businessId } });
  const settings = {
    dailyLimit: session?.dailyLimit ?? env.WHATSAPP_DAILY_LIMIT,
    sendDelayMs: session?.sendDelayMs ?? env.WHATSAPP_SEND_DELAY_MS,
    sendJitterMs: session?.sendJitterMs ?? env.WHATSAPP_SEND_JITTER_MS,
    windowStartHour: session?.windowStartHour ?? 9,
    windowEndHour: session?.windowEndHour ?? 21,
  };
  const pace = withJitter(settings.sendDelayMs, settings.sendJitterMs);

  const transport = whatsappTransport();

  // A shop that disconnected mid-campaign is paused rather than failed, so
  // they can reconnect and pick up exactly where it stopped.
  if (!transport.isReady(campaign.businessId)) {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: CampaignStatus.PAUSED } });
    logger.warn({ campaignId: campaign.id }, "whatsapp: campaign paused — account not connected");
    return { outcome: "blocked", nextDelayMs: IDLE_DELAY_MS };
  }

  // Outside quiet hours the campaign stays SENDING and simply waits, so it
  // resumes by itself in the morning with no one having to touch it.
  if (!isWithinWindow(settings)) {
    const wait = msUntilWindowOpens(settings);
    logger.info(
      { campaignId: campaign.id, minutes: Math.round(wait / 60_000) },
      "whatsapp: outside the sending window, waiting",
    );
    // Capped at a minute rather than sleeping blindly until morning: a shop
    // that widens its window should see sending resume straight away, and one
    // tick a minute overnight costs nothing.
    return { outcome: "blocked", nextDelayMs: Math.min(wait, 60_000) };
  }

  if ((await sentTodayFor(campaign.businessId)) >= settings.dailyLimit) {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: CampaignStatus.PAUSED } });
    logger.info(
      { campaignId: campaign.id, dailyLimit: settings.dailyLimit },
      "whatsapp: daily limit reached, campaign paused until tomorrow",
    );
    return { outcome: "blocked", nextDelayMs: IDLE_DELAY_MS };
  }

  const message = await prisma.campaignMessage.findFirst({
    where: { campaignId: campaign.id, status: CampaignMessageStatus.PENDING },
    orderBy: { id: "asc" },
  });

  if (!message) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: CampaignStatus.COMPLETED, completedAt: new Date() },
    });
    logger.info({ campaignId: campaign.id }, "whatsapp: campaign finished");
    return { outcome: "idle", nextDelayMs: IDLE_DELAY_MS };
  }

  // Someone who opted out after the campaign was built must not be messaged.
  if (message.contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: message.contactId },
      select: { optedOut: true },
    });
    if (contact?.optedOut) {
      await prisma.$transaction([
        prisma.campaignMessage.update({
          where: { id: message.id },
          data: { status: CampaignMessageStatus.SKIPPED, error: "Contact opted out" },
        }),
        prisma.campaign.update({ where: { id: campaign.id }, data: { skippedCount: { increment: 1 } } }),
      ]);
      // Nothing actually left the handset, so there is no need to pace this.
      return { outcome: "sent", nextDelayMs: 250 };
    }
  }

  try {
    await transport.sendText(campaign.businessId, message.phone, message.body);
    await prisma.$transaction([
      prisma.campaignMessage.update({
        where: { id: message.id },
        data: {
          status: CampaignMessageStatus.SENT,
          sentAt: new Date(),
          attempts: { increment: 1 },
          error: null,
        },
      }),
      prisma.campaign.update({ where: { id: campaign.id }, data: { sentCount: { increment: 1 } } }),
    ]);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await prisma.$transaction([
      prisma.campaignMessage.update({
        where: { id: message.id },
        data: { status: CampaignMessageStatus.FAILED, attempts: { increment: 1 }, error: reason.slice(0, 500) },
      }),
      prisma.campaign.update({ where: { id: campaign.id }, data: { failedCount: { increment: 1 } } }),
    ]);
    logger.warn({ campaignId: campaign.id, phone: message.phone, reason }, "whatsapp: message failed");
  }

  return { outcome: "sent", nextDelayMs: pace };
}

async function tick(): Promise<void> {
  if (tickState.running) return;
  tickState.running = true;
  let nextDelayMs = IDLE_DELAY_MS;
  try {
    ({ nextDelayMs } = await sendNextMessage());
  } catch (err) {
    logger.error({ err }, "whatsapp dispatcher tick failed");
  } finally {
    tickState.running = false;
    schedule(nextDelayMs);
  }
}

function schedule(delayMs: number): void {
  if (tickState.timer) clearTimeout(tickState.timer);
  tickState.timer = setTimeout(() => void tick(), delayMs);
  // A pending send must never hold the process open on shutdown.
  tickState.timer.unref?.();
}

export function startDispatcher(): void {
  if (tickState.timer) return;
  logger.info("whatsapp dispatcher started");
  schedule(IDLE_DELAY_MS);
}

export function stopDispatcher(): void {
  if (tickState.timer) clearTimeout(tickState.timer);
  tickState.timer = null;
}
