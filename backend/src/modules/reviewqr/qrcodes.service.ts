import { Prisma, ReviewChannel, ReviewQrStatus, UserRole } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";
import { availableChannels, resolveChannelUrl } from "./reviewqr.service";

interface Actor {
  sub: string;
  role: UserRole;
}

// Unambiguous alphabet: no O/0, I/1, S/5 — these codes get read off a printed
// board and typed in by hand when a camera struggles.
const ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ23456789";
const CODE_LENGTH = 6;

function generateCode(): string {
  let body = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `MK-${body}`;
}

// Normalise whatever the shop typed or scanned: "mk 7f3k2a" -> "MK-7F3K2A".
export function normalizeCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = cleaned.startsWith("MK") ? cleaned.slice(2) : cleaned;
  return `MK-${body}`;
}

// Admin issues a batch of boards, optionally all pointing at one platform
// (picked from the list). Codes are unique; collisions are retried.
export async function generateBatch(count: number, batchLabel?: string, channel?: ReviewChannel) {
  const created: string[] = [];

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    for (;;) {
      const code = generateCode();
      try {
        await prisma.reviewQrCode.create({ data: { code, batchLabel, channel } });
        created.push(code);
        break;
      } catch (err) {
        // Unique-constraint clash — try another code.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempts < 5) {
          attempts++;
          continue;
        }
        throw err;
      }
    }
  }

  return { created: created.length, codes: created, batchLabel: batchLabel ?? null };
}

const QR_INCLUDE = {
  business: { select: { id: true, name: true, slug: true, city: true } },
} satisfies Prisma.ReviewQrCodeInclude;

export async function listQrCodes(query: {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  batchLabel?: string;
}) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where: Prisma.ReviewQrCodeWhereInput = {};
  if (query.status && query.status in ReviewQrStatus) where.status = query.status as ReviewQrStatus;
  if (query.batchLabel) where.batchLabel = query.batchLabel;
  if (query.search) {
    where.OR = [
      { code: { contains: query.search.toUpperCase() } },
      { business: { is: { name: { contains: query.search } } } },
    ];
  }

  const [items, total, unassigned, assigned] = await Promise.all([
    prisma.reviewQrCode.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: QR_INCLUDE }),
    prisma.reviewQrCode.count({ where }),
    prisma.reviewQrCode.count({ where: { status: ReviewQrStatus.UNASSIGNED } }),
    prisma.reviewQrCode.count({ where: { status: ReviewQrStatus.ASSIGNED } }),
  ]);

  return { items, meta: { page, pageSize, total }, summary: { unassigned, assigned } };
}

// Public lookup used by the confirm screen after a shop scans a board.
// Deliberately returns only what the claim screen needs.
export async function lookupCode(rawCode: string) {
  const code = normalizeCode(rawCode);
  const qr = await prisma.reviewQrCode.findUnique({ where: { code }, include: QR_INCLUDE });
  if (!qr) throw AppError.notFound("That QR code was not recognised. Check the code printed on the board.");

  return {
    code: qr.code,
    status: qr.status,
    channel: qr.channel,
    batchLabel: qr.batchLabel,
    scanCount: qr.scanCount,
    assignedAt: qr.assignedAt,
    business: qr.business,
  };
}

// A shop owner (or dealer/admin) confirms the scanned board and attaches it to
// one of their businesses.
export async function claimCode(actor: Actor, rawCode: string, businessId: string, channel?: ReviewChannel) {
  const code = normalizeCode(rawCode);

  const [qr, business] = await Promise.all([
    prisma.reviewQrCode.findUnique({ where: { code } }),
    prisma.business.findUnique({ where: { id: businessId } }),
  ]);

  if (!qr) throw AppError.notFound("That QR code was not recognised. Check the code printed on the board.");
  if (!business) throw AppError.notFound("Business not found");

  if (actor.role !== UserRole.ADMIN && business.ownerId !== actor.sub) {
    throw AppError.forbidden("You can only attach a QR board to your own business");
  }
  if (qr.status === ReviewQrStatus.DISABLED) {
    throw AppError.badRequest("This QR board has been disabled. Please contact the admin for a replacement.");
  }
  // A board whose business was deleted keeps status ASSIGNED but loses the
  // link; treat that as free rather than leaving the board unusable forever.
  if (qr.status === ReviewQrStatus.ASSIGNED && qr.businessId) {
    if (qr.businessId === businessId) {
      throw AppError.conflict("This QR board is already attached to this business.");
    }
    throw AppError.conflict("This QR board is already attached to another business. Contact the admin to reassign it.");
  }

  const updated = await prisma.reviewQrCode.update({
    where: { id: qr.id },
    data: {
      businessId,
      status: ReviewQrStatus.ASSIGNED,
      assignedAt: new Date(),
      assignedById: actor.sub,
      // Purpose picked at claim time overrides whatever the batch was issued with.
      ...(channel ? { channel } : {}),
    },
    include: QR_INCLUDE,
  });

  // Warn the owner if the board will not lead anywhere useful yet.
  const channels = availableChannels(business);
  const effective = updated.channel ?? business.preferredReviewChannel ?? channels[0] ?? null;
  return {
    code: updated.code,
    status: updated.status,
    channel: updated.channel,
    business: updated.business,
    assignedAt: updated.assignedAt,
    reviewChannelsConfigured: channels,
    needsReviewLinks: channels.length === 0,
    // Where a scan will actually land right now, and whether that link exists.
    effectiveChannel: effective,
    effectiveUrl: effective ? resolveChannelUrl(business, effective) : null,
  };
}

// The owner re-points one of their boards at a different platform.
export async function setBoardChannel(actor: Actor, qrId: string, channel: ReviewChannel | null) {
  const qr = await prisma.reviewQrCode.findUnique({ where: { id: qrId }, include: { business: true } });
  if (!qr) throw AppError.notFound("QR board not found");
  if (!qr.business) throw AppError.badRequest("Attach this board to a business first");
  if (actor.role !== UserRole.ADMIN && qr.business.ownerId !== actor.sub) {
    throw AppError.forbidden("You do not own this business");
  }
  if (channel && !resolveChannelUrl(qr.business, channel)) {
    throw AppError.badRequest(
      `Add your ${channel.toLowerCase()} link in "Connect your review pages" before pointing a board at it`,
    );
  }

  const updated = await prisma.reviewQrCode.update({
    where: { id: qrId },
    data: { channel },
    select: { id: true, code: true, channel: true, status: true, scanCount: true, assignedAt: true },
  });
  return updated;
}

// The boards attached to a business, for its dashboard.
export async function listBusinessQrCodes(actor: Actor, businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");
  if (actor.role !== UserRole.ADMIN && business.ownerId !== actor.sub) {
    throw AppError.forbidden("You do not own this business");
  }

  return prisma.reviewQrCode.findMany({
    where: { businessId },
    orderBy: { assignedAt: "desc" },
    select: { id: true, code: true, channel: true, status: true, scanCount: true, assignedAt: true },
  });
}

// Admin actions: detach a board (back to the pool) or disable a lost one.
export async function updateQrCodeAsAdmin(
  actor: Actor,
  id: string,
  data: { status?: ReviewQrStatus; businessId?: string | null; channel?: ReviewChannel | null },
) {
  // Detaching or reassigning a board is an admin decision: a dealer or owner
  // must not be able to take a board off a shop, or move it to another one.
  // The route already enforces this; asserting here keeps the guarantee even
  // if this service is ever called from somewhere less restricted.
  if (actor.role !== UserRole.ADMIN) {
    throw AppError.forbidden("Only an admin can detach or reassign a QR board");
  }
  if (data.status === undefined && data.businessId === undefined && data.channel === undefined) {
    throw AppError.badRequest("Provide a status, business, or channel to change");
  }

  const qr = await prisma.reviewQrCode.findUnique({ where: { id } });
  if (!qr) throw AppError.notFound("QR code not found");

  const patch: Prisma.ReviewQrCodeUpdateInput = {};
  if (data.channel !== undefined) patch.channel = data.channel;

  if (data.businessId !== undefined) {
    if (data.businessId === null) {
      patch.business = { disconnect: true };
      patch.status = ReviewQrStatus.UNASSIGNED;
      patch.assignedAt = null;
      patch.assignedById = null;
    } else {
      const business = await prisma.business.findUnique({ where: { id: data.businessId } });
      if (!business) throw AppError.badRequest("Target business not found");
      patch.business = { connect: { id: data.businessId } };
      patch.status = ReviewQrStatus.ASSIGNED;
      patch.assignedAt = new Date();
    }
  }

  // An explicit status wins, except that ASSIGNED needs a business attached.
  if (data.status) {
    if (data.status === ReviewQrStatus.ASSIGNED && !(data.businessId ?? qr.businessId)) {
      throw AppError.badRequest("Attach the code to a business before marking it assigned");
    }
    patch.status = data.status;
    if (data.status === ReviewQrStatus.UNASSIGNED) {
      patch.business = { disconnect: true };
      patch.assignedAt = null;
      patch.assignedById = null;
    }
  }

  return prisma.reviewQrCode.update({ where: { id }, data: patch, include: QR_INCLUDE });
}

// Resolve a scan of a pre-printed board. Returns a discriminated result so the
// caller can redirect, or send the shop to the claim screen.
export async function resolveQrScan(
  rawCode: string,
  userAgent?: string,
): Promise<
  | { kind: "redirect"; url: string; channel: import("@prisma/client").ReviewChannel }
  | { kind: "claim"; code: string }
  | { kind: "listing"; slug: string }
  | { kind: "unknown"; code: string }
> {
  const code = normalizeCode(rawCode);
  const qr = await prisma.reviewQrCode.findUnique({ where: { code }, include: { business: true } });

  if (!qr || qr.status === ReviewQrStatus.DISABLED) return { kind: "unknown", code };
  // Not claimed yet — the shop should confirm and attach it.
  if (!qr.business) return { kind: "claim", code };

  const business = qr.business;
  const channels = availableChannels(business);
  if (channels.length === 0) return { kind: "listing", slug: business.slug };

  // The board's own purpose wins — that's what was picked from the list when
  // it was issued or claimed. Fall back to the shop's default, then to
  // whatever it has configured, so a scan always lands somewhere.
  const channel =
    (qr.channel && resolveChannelUrl(business, qr.channel) ? qr.channel : undefined) ??
    (business.preferredReviewChannel && resolveChannelUrl(business, business.preferredReviewChannel)
      ? business.preferredReviewChannel
      : undefined) ??
    channels[0];

  const url = resolveChannelUrl(business, channel);
  if (!url) return { kind: "listing", slug: business.slug };

  // Analytics must never delay the customer's redirect.
  Promise.all([
    prisma.reviewScan.create({ data: { businessId: business.id, qrCodeId: qr.id, channel, userAgent } }),
    prisma.reviewQrCode.update({ where: { id: qr.id }, data: { scanCount: { increment: 1 } } }),
  ]).catch(() => undefined);

  return { kind: "redirect", url, channel };
}

// Called when a business is deleted: its boards return to the unassigned pool
// so they can be handed to another shop, instead of being stranded as
// "assigned" with nothing behind them.
export async function releaseBoardsForBusiness(
  tx: Prisma.TransactionClient,
  businessId: string,
): Promise<void> {
  await tx.reviewQrCode.updateMany({
    where: { businessId },
    data: { businessId: null, status: ReviewQrStatus.UNASSIGNED, assignedAt: null, assignedById: null, channel: null },
  });
}
