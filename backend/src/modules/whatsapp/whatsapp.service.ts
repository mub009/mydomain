import { CampaignMessageStatus, CampaignStatus, ContactSource, Prisma, UserRole, WhatsappStatus } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";
import { env } from "@/config/env";
import { normalizePhone } from "./phone";
import { describeWindow, isWithinWindow } from "./sendingWindow";
import { parseContactSheet } from "./importer";
import { buildContactTemplate } from "./contactTemplate";
import { whatsappTransport } from "./transport";

interface Actor {
  sub: string;
  role: UserRole;
}

async function ownedBusiness(actor: Actor, businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");
  if (actor.role !== UserRole.ADMIN && business.ownerId !== actor.sub) {
    throw AppError.forbidden("You do not own this business");
  }
  return business;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function getSession(actor: Actor, businessId: string) {
  await ownedBusiness(actor, businessId);
  const session = await prisma.whatsappSession.findUnique({ where: { businessId } });
  const transport = whatsappTransport();

  // The row is written by the transport as events arrive; the in-memory flag
  // is the truth about whether a send would work *right now*. After a restart
  // the row can still say CONNECTED while no client is running.
  const live = transport.isReady(businessId);
  const status = session?.status ?? WhatsappStatus.DISCONNECTED;

  const settings = {
    dailyLimit: session?.dailyLimit ?? env.WHATSAPP_DAILY_LIMIT,
    sendDelayMs: session?.sendDelayMs ?? env.WHATSAPP_SEND_DELAY_MS,
    sendJitterMs: session?.sendJitterMs ?? env.WHATSAPP_SEND_JITTER_MS,
    windowStartHour: session?.windowStartHour ?? 9,
    windowEndHour: session?.windowEndHour ?? 21,
    autoOptOut: session?.autoOptOut ?? true,
  };

  return {
    status: status === WhatsappStatus.CONNECTED && !live ? WhatsappStatus.DISCONNECTED : status,
    phoneNumber: session?.phoneNumber ?? null,
    qrDataUrl: session?.qrDataUrl ?? null,
    lastError: session?.lastError ?? null,
    connectedAt: session?.connectedAt ?? null,
    canSend: live,
    transport: env.WHATSAPP_TRANSPORT,
    sentToday: await sentToday(businessId),
    settings,
    // Derived, so the dashboard can say "paused until 9am" without repeating
    // the window arithmetic on the client.
    withinWindow: isWithinWindow(settings),
    windowLabel: describeWindow(settings),
    // Roughly how long a full day's allowance takes at this pace, which is
    // what makes the delay setting concrete.
    estimatedPerHour: Math.max(1, Math.floor(3_600_000 / (settings.sendDelayMs + settings.sendJitterMs / 2))),
  };
}

export interface SendingSettingsInput {
  dailyLimit?: number;
  sendDelayMs?: number;
  sendJitterMs?: number;
  windowStartHour?: number;
  windowEndHour?: number;
  autoOptOut?: boolean;
}

/** Per-shop sending controls: pace, daily cap, quiet hours, STOP handling. */
export async function updateSendingSettings(actor: Actor, businessId: string, data: SendingSettingsInput) {
  await ownedBusiness(actor, businessId);

  await prisma.whatsappSession.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  });

  return getSession(actor, businessId);
}

/**
 * Sends a single message to a number of the shop's choosing, so wording and
 * placeholders can be checked before a list of hundreds goes out. Deliberately
 * bypasses the campaign machinery — there is nothing to track or resume.
 */
export async function sendTestMessage(actor: Actor, businessId: string, phone: string, body: string) {
  const business = await ownedBusiness(actor, businessId);

  const normalized = normalizePhone(phone);
  if (!normalized.ok) throw AppError.badRequest(normalized.reason ?? "That phone number does not look right");

  const transport = whatsappTransport();
  if (!transport.isReady(businessId)) throw AppError.badRequest("Connect your WhatsApp account before sending");

  const rendered = renderTemplate(body, {
    name: "there",
    business: business.name,
    city: business.city,
    phone: normalized.phone,
  });

  try {
    await transport.sendText(businessId, normalized.phone, rendered);
  } catch (err) {
    throw AppError.badRequest(err instanceof Error ? err.message : "Could not send the test message");
  }

  return { phone: normalized.phone, body: rendered };
}

export async function connectSession(actor: Actor, businessId: string) {
  await ownedBusiness(actor, businessId);
  await whatsappTransport().connect(businessId);
  return getSession(actor, businessId);
}

export async function disconnectSession(actor: Actor, businessId: string) {
  await ownedBusiness(actor, businessId);
  await whatsappTransport().disconnect(businessId);
  return getSession(actor, businessId);
}

// A day's sending, counted across every campaign this business has run.
async function sentToday(businessId: string): Promise<number> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return prisma.campaignMessage.count({
    where: {
      campaign: { businessId },
      status: CampaignMessageStatus.SENT,
      sentAt: { gte: startOfToday },
    },
  });
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export async function listContacts(
  actor: Actor,
  businessId: string,
  query: { search?: string; tag?: string; optedOut?: boolean; page?: number; pageSize?: number },
) {
  await ownedBusiness(actor, businessId);
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.ContactWhereInput = {
    businessId,
    ...(query.tag ? { tag: query.tag } : {}),
    ...(query.optedOut === undefined ? {} : { optedOut: query.optedOut }),
    ...(query.search
      ? { OR: [{ name: { contains: query.search } }, { phone: { contains: query.search } }] }
      : {}),
  };

  const [items, total, optedOut, tags] = await Promise.all([
    prisma.contact.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    prisma.contact.count({ where }),
    prisma.contact.count({ where: { businessId, optedOut: true } }),
    prisma.contact.groupBy({
      by: ["tag"],
      where: { businessId, tag: { not: null } },
      _count: { _all: true },
    }),
  ]);

  return {
    items,
    meta: { page, pageSize, total },
    summary: {
      optedOut,
      tags: tags
        .filter((row) => row.tag)
        .map((row) => ({ tag: row.tag as string, count: row._count._all }))
        .sort((a, b) => b.count - a.count),
    },
  };
}

export async function createContact(
  actor: Actor,
  businessId: string,
  data: { name: string; phone: string; email?: string; tag?: string },
) {
  await ownedBusiness(actor, businessId);
  const { phone, ok, reason } = normalizePhone(data.phone);
  if (!ok) throw AppError.badRequest(reason ?? "That phone number does not look right");

  const existing = await prisma.contact.findUnique({ where: { businessId_phone: { businessId, phone } } });
  if (existing) throw AppError.conflict(`${data.phone} is already in your contacts as "${existing.name}"`);

  return prisma.contact.create({
    data: { businessId, name: data.name, phone, email: data.email ?? null, tag: data.tag ?? null },
  });
}

export async function updateContact(
  actor: Actor,
  contactId: string,
  data: { name?: string; tag?: string | null; optedOut?: boolean },
) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId }, include: { business: true } });
  if (!contact) throw AppError.notFound("Contact not found");
  if (actor.role !== UserRole.ADMIN && contact.business.ownerId !== actor.sub) {
    throw AppError.forbidden("You do not own this business");
  }

  return prisma.contact.update({
    where: { id: contactId },
    data: {
      ...data,
      // Stamp the moment someone opted out, and clear it if they opt back in.
      ...(data.optedOut === undefined ? {} : { optedOutAt: data.optedOut ? new Date() : null }),
    },
  });
}

export async function deleteContact(actor: Actor, contactId: string) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId }, include: { business: true } });
  if (!contact) throw AppError.notFound("Contact not found");
  if (actor.role !== UserRole.ADMIN && contact.business.ownerId !== actor.sub) {
    throw AppError.forbidden("You do not own this business");
  }
  await prisma.contact.delete({ where: { id: contactId } });
  return { id: contactId };
}

/** The blank sheet a shop fills in before uploading. */
export async function contactTemplate(actor: Actor, businessId: string) {
  const business = await ownedBusiness(actor, businessId);
  return { filename: `${business.slug}-contacts-template.xlsx`, buffer: await buildContactTemplate(business.name) };
}

/**
 * Imports a spreadsheet. Existing numbers have their name refreshed rather
 * than being duplicated, and anyone who previously opted out stays opted out —
 * re-uploading a list must never quietly re-subscribe them.
 */
export async function importContacts(actor: Actor, businessId: string, file: Buffer, tag?: string) {
  await ownedBusiness(actor, businessId);

  const parsed = await parseContactSheet(file);
  if (parsed.contacts.length === 0) {
    throw AppError.badRequest(
      parsed.problems.length > 0
        ? `No usable rows. First problem: row ${parsed.problems[0].row} — ${parsed.problems[0].reason}`
        : "No contacts found in that file. Check it has a phone column.",
    );
  }

  const phones = parsed.contacts.map((c) => c.phone);
  const existing = await prisma.contact.findMany({
    where: { businessId, phone: { in: phones } },
    select: { id: true, phone: true, optedOut: true },
  });
  const existingByPhone = new Map(existing.map((c) => [c.phone, c]));

  const toCreate = parsed.contacts.filter((c) => !existingByPhone.has(c.phone));
  const toUpdate = parsed.contacts.filter((c) => existingByPhone.has(c.phone));

  if (toCreate.length > 0) {
    await prisma.contact.createMany({
      data: toCreate.map((c) => ({
        businessId,
        name: c.name,
        phone: c.phone,
        email: c.email ?? null,
        tag: tag ?? c.tag ?? null,
        source: ContactSource.IMPORT,
      })),
    });
  }

  // Refresh names/tags on rows we already had, leaving optedOut untouched.
  for (const contact of toUpdate) {
    const row = existingByPhone.get(contact.phone);
    if (!row) continue;
    await prisma.contact.update({
      where: { id: row.id },
      data: {
        name: contact.name,
        ...(contact.email ? { email: contact.email } : {}),
        ...(tag ?? contact.tag ? { tag: tag ?? contact.tag } : {}),
      },
    });
  }

  return {
    imported: toCreate.length,
    updated: toUpdate.length,
    duplicatesInFile: parsed.duplicatesInFile,
    skipped: parsed.problems.length,
    // Enough to fix the sheet without flooding the response.
    problems: parsed.problems.slice(0, 20),
    totalRows: parsed.totalRows,
    // Re-imported numbers that had opted out, so the shop knows they were
    // added back to the list but will still not be messaged.
    stillOptedOut: toUpdate.filter((c) => existingByPhone.get(c.phone)?.optedOut).length,
  };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/** Placeholders a template may use, filled per recipient at send time. */
export const TEMPLATE_VARIABLES = ["name", "business", "city", "phone"] as const;

export function renderTemplate(
  body: string,
  values: { name: string; business: string; city: string; phone: string },
): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = (values as Record<string, string>)[key.toLowerCase()];
    // An unknown placeholder is left as typed rather than blanked, so a typo
    // is visible in the preview instead of silently eating text.
    return value ?? match;
  });
}

export async function listTemplates(actor: Actor, businessId: string) {
  await ownedBusiness(actor, businessId);
  return prisma.messageTemplate.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
}

export async function createTemplate(actor: Actor, businessId: string, data: { name: string; body: string }) {
  await ownedBusiness(actor, businessId);
  return prisma.messageTemplate.create({ data: { businessId, ...data } });
}

export async function updateTemplate(actor: Actor, templateId: string, data: { name?: string; body?: string }) {
  const template = await prisma.messageTemplate.findUnique({
    where: { id: templateId },
    include: { business: true },
  });
  if (!template) throw AppError.notFound("Template not found");
  if (actor.role !== UserRole.ADMIN && template.business.ownerId !== actor.sub) {
    throw AppError.forbidden("You do not own this business");
  }
  return prisma.messageTemplate.update({ where: { id: templateId }, data });
}

export async function deleteTemplate(actor: Actor, templateId: string) {
  const template = await prisma.messageTemplate.findUnique({
    where: { id: templateId },
    include: { business: true },
  });
  if (!template) throw AppError.notFound("Template not found");
  if (actor.role !== UserRole.ADMIN && template.business.ownerId !== actor.sub) {
    throw AppError.forbidden("You do not own this business");
  }
  await prisma.messageTemplate.delete({ where: { id: templateId } });
  return { id: templateId };
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export interface CampaignInput {
  name: string;
  body: string;
  templateId?: string;
  /** Restrict the audience to one tag; omitted means every contact. */
  tag?: string;
  /** Explicit recipients, when the shop ticked individual rows. */
  contactIds?: string[];
}

/**
 * Builds a campaign and freezes its recipient list. Opted-out contacts are
 * excluded here rather than filtered at send time, so the count the shop
 * confirms is the count that actually goes out.
 */
export async function createCampaign(actor: Actor, businessId: string, input: CampaignInput) {
  const business = await ownedBusiness(actor, businessId);

  const where: Prisma.ContactWhereInput = {
    businessId,
    optedOut: false,
    ...(input.contactIds?.length ? { id: { in: input.contactIds } } : {}),
    ...(input.tag ? { tag: input.tag } : {}),
  };

  const contacts = await prisma.contact.findMany({ where });
  if (contacts.length === 0) {
    throw AppError.badRequest(
      "No contacts match that audience. Import some contacts, or check they have not all opted out.",
    );
  }

  const campaign = await prisma.campaign.create({
    data: {
      businessId,
      name: input.name,
      templateId: input.templateId ?? null,
      body: input.body,
      totalCount: contacts.length,
      messages: {
        create: contacts.map((contact) => ({
          contactId: contact.id,
          name: contact.name,
          phone: contact.phone,
          body: renderTemplate(input.body, {
            name: contact.name,
            business: business.name,
            city: business.city,
            phone: contact.phone,
          }),
        })),
      },
    },
  });

  return campaign;
}

export async function listCampaigns(actor: Actor, businessId: string, query: { page?: number; pageSize?: number }) {
  await ownedBusiness(actor, businessId);
  const { page, pageSize, skip, take } = parsePagination(query);

  const [items, total] = await Promise.all([
    prisma.campaign.findMany({
      where: { businessId },
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { template: { select: { name: true } } },
    }),
    prisma.campaign.count({ where: { businessId } }),
  ]);

  return { items, meta: { page, pageSize, total } };
}

export async function getCampaign(actor: Actor, campaignId: string, query: { page?: number; pageSize?: number } = {}) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { business: { select: { ownerId: true } } },
  });
  if (!campaign) throw AppError.notFound("Campaign not found");
  if (actor.role !== UserRole.ADMIN && campaign.business.ownerId !== actor.sub) {
    throw AppError.forbidden("You do not own this business");
  }

  const { page, pageSize, skip, take } = parsePagination(query);
  const [messages, total] = await Promise.all([
    prisma.campaignMessage.findMany({
      where: { campaignId },
      skip,
      take,
      orderBy: [{ status: "asc" }, { sentAt: "desc" }],
    }),
    prisma.campaignMessage.count({ where: { campaignId } }),
  ]);

  const { business: _business, ...rest } = campaign;
  return { campaign: rest, messages, meta: { page, pageSize, total } };
}

/** Start or resume sending. */
export async function startCampaign(actor: Actor, campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { business: { select: { ownerId: true, id: true } } },
  });
  if (!campaign) throw AppError.notFound("Campaign not found");
  if (actor.role !== UserRole.ADMIN && campaign.business.ownerId !== actor.sub) {
    throw AppError.forbidden("You do not own this business");
  }
  if (campaign.status === CampaignStatus.COMPLETED) throw AppError.badRequest("This campaign has already finished");
  if (campaign.status === CampaignStatus.CANCELLED) throw AppError.badRequest("This campaign was cancelled");

  if (!whatsappTransport().isReady(campaign.businessId)) {
    throw AppError.badRequest("Connect your WhatsApp account before sending");
  }

  const remaining = await prisma.campaignMessage.count({
    where: { campaignId, status: CampaignMessageStatus.PENDING },
  });
  if (remaining === 0) throw AppError.badRequest("Every message in this campaign has already been dealt with");

  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: CampaignStatus.SENDING,
      startedAt: campaign.startedAt ?? new Date(),
    },
  });
}

/**
 * Re-queues just the failures. A campaign of 500 where 12 numbers were not on
 * WhatsApp should not have to be rebuilt from scratch to try those 12 again.
 */
export async function retryFailedMessages(actor: Actor, campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { business: { select: { ownerId: true } } },
  });
  if (!campaign) throw AppError.notFound("Campaign not found");
  if (actor.role !== UserRole.ADMIN && campaign.business.ownerId !== actor.sub) {
    throw AppError.forbidden("You do not own this business");
  }

  const failed = await prisma.campaignMessage.count({
    where: { campaignId, status: CampaignMessageStatus.FAILED },
  });
  if (failed === 0) throw AppError.badRequest("Nothing failed in this campaign");

  const [, updated] = await prisma.$transaction([
    prisma.campaignMessage.updateMany({
      where: { campaignId, status: CampaignMessageStatus.FAILED },
      data: { status: CampaignMessageStatus.PENDING, error: null },
    }),
    prisma.campaign.update({
      where: { id: campaignId },
      data: {
        // Back to a state the shop can start again, with the failures no
        // longer counted against it.
        status: CampaignStatus.PAUSED,
        failedCount: { decrement: failed },
        completedAt: null,
      },
    }),
  ]);

  return { requeued: failed, campaign: updated };
}

export async function setCampaignStatus(actor: Actor, campaignId: string, status: CampaignStatus) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { business: { select: { ownerId: true } } },
  });
  if (!campaign) throw AppError.notFound("Campaign not found");
  if (actor.role !== UserRole.ADMIN && campaign.business.ownerId !== actor.sub) {
    throw AppError.forbidden("You do not own this business");
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status,
      ...(status === CampaignStatus.CANCELLED ? { completedAt: new Date() } : {}),
    },
  });
}
