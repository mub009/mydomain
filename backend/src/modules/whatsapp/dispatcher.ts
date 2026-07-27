import { CampaignMessageStatus, CampaignStatus } from "@prisma/client";
import { prisma } from "@/config/database";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { whatsappTransport } from "./transport";

/**
 * Sends queued campaign messages, one at a time, with a pause between each.
 *
 * Everything here is deliberately unhurried. WhatsApp is not a bulk channel —
 * a burst of identical messages from one handset is the fastest way to get a
 * shop's number restricted — so the loop sends a single message per tick, waits
 * a randomised interval, and stops for the day once the business hits its cap.
 */

const tickState = { running: false, timer: null as NodeJS.Timeout | null };

function nextDelay(): number {
  return env.WHATSAPP_SEND_DELAY_MS + Math.floor(Math.random() * (env.WHATSAPP_SEND_JITTER_MS + 1));
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

/**
 * Handles one message and reports whether there is more to do. Exported so a
 * test can drive the loop deterministically instead of waiting on timers.
 */
export async function sendNextMessage(): Promise<"sent" | "idle" | "blocked"> {
  const campaign = await prisma.campaign.findFirst({
    where: { status: CampaignStatus.SENDING },
    orderBy: { startedAt: "asc" },
  });
  if (!campaign) return "idle";

  const transport = whatsappTransport();

  // A shop that disconnected mid-campaign is paused rather than failed, so
  // they can reconnect and pick up exactly where it stopped.
  if (!transport.isReady(campaign.businessId)) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: CampaignStatus.PAUSED },
    });
    logger.warn({ campaignId: campaign.id }, "whatsapp: campaign paused — account not connected");
    return "blocked";
  }

  if ((await sentTodayFor(campaign.businessId)) >= env.WHATSAPP_DAILY_LIMIT) {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: CampaignStatus.PAUSED } });
    logger.info({ campaignId: campaign.id }, "whatsapp: daily limit reached, campaign paused until tomorrow");
    return "blocked";
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
    return "idle";
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
      return "sent";
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

  return "sent";
}

async function tick(): Promise<void> {
  if (tickState.running) return;
  tickState.running = true;
  try {
    await sendNextMessage();
  } catch (err) {
    logger.error({ err }, "whatsapp dispatcher tick failed");
  } finally {
    tickState.running = false;
    schedule();
  }
}

function schedule(): void {
  if (tickState.timer) clearTimeout(tickState.timer);
  tickState.timer = setTimeout(() => void tick(), nextDelay());
  // A pending send must never hold the process open on shutdown.
  tickState.timer.unref?.();
}

export function startDispatcher(): void {
  if (tickState.timer) return;
  logger.info(
    { delayMs: env.WHATSAPP_SEND_DELAY_MS, jitterMs: env.WHATSAPP_SEND_JITTER_MS, dailyLimit: env.WHATSAPP_DAILY_LIMIT },
    "whatsapp dispatcher started",
  );
  schedule();
}

export function stopDispatcher(): void {
  if (tickState.timer) clearTimeout(tickState.timer);
  tickState.timer = null;
}
