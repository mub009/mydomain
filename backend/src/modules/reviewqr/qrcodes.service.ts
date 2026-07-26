import { Prisma, ReviewQrStatus, UserRole } from "@prisma/client";
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

// Admin issues a batch of boards. Codes are unique; collisions are retried.
export async function generateBatch(count: number, batchLabel?: string) {
  const created: string[] = [];

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    for (;;) {
      const code = generateCode();
      try {
        await prisma.reviewQrCode.create({ data: { code, batchLabel } });
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
    batchLabel: qr.batchLabel,
    scanCount: qr.scanCount,
    assignedAt: qr.assignedAt,
    business: qr.business,
  };
}

// A shop owner (or dealer/admin) confirms the scanned board and attaches it to
// one of their businesses.
export async function claimCode(actor: Actor, rawCode: string, businessId: string) {
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
  if (qr.status === ReviewQrStatus.ASSIGNED) {
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
    },
    include: QR_INCLUDE,
  });

  // Warn the owner if the board will not lead anywhere useful yet.
  const channels = availableChannels(business);
  return {
    code: updated.code,
    status: updated.status,
    business: updated.business,
    assignedAt: updated.assignedAt,
    reviewChannelsConfigured: channels,
    needsReviewLinks: channels.length === 0,
  };
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
    select: { id: true, code: true, status: true, scanCount: true, assignedAt: true },
  });
}

// Admin actions: detach a board (back to the pool) or disable a lost one.
export async function updateQrCodeAsAdmin(id: string, data: { status?: ReviewQrStatus; businessId?: string | null }) {
  if (data.status === undefined && data.businessId === undefined) {
    throw AppError.badRequest("Provide a status or a business to attach");
  }

  const qr = await prisma.reviewQrCode.findUnique({ where: { id } });
  if (!qr) throw AppError.notFound("QR code not found");

  const patch: Prisma.ReviewQrCodeUpdateInput = {};

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

  const channel =
    business.preferredReviewChannel && resolveChannelUrl(business, business.preferredReviewChannel)
      ? business.preferredReviewChannel
      : channels[0];
  const url = resolveChannelUrl(business, channel);
  if (!url) return { kind: "listing", slug: business.slug };

  // Analytics must never delay the customer's redirect.
  Promise.all([
    prisma.reviewScan.create({ data: { businessId: business.id, qrCodeId: qr.id, channel, userAgent } }),
    prisma.reviewQrCode.update({ where: { id: qr.id }, data: { scanCount: { increment: 1 } } }),
  ]).catch(() => undefined);

  return { kind: "redirect", url, channel };
}
