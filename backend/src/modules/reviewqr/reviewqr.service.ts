import { ReviewChannel, UserRole } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";

interface Actor {
  sub: string;
  role: UserRole;
}

export interface ReviewLinksInput {
  googlePlaceId?: string | null;
  googleReviewUrl?: string | null;
  instagramUsername?: string | null;
  facebookPageUrl?: string | null;
  youtubeUrl?: string | null;
  preferredReviewChannel?: ReviewChannel | null;
}

type LinkSource = Pick<
  ReviewLinksInput,
  "googlePlaceId" | "googleReviewUrl" | "instagramUsername" | "facebookPageUrl" | "youtubeUrl"
> & { website?: string | null };

// Google's canonical "write a review" deep link. Scanning it on a phone opens
// the Maps app straight on the review composer for that place.
export function googleReviewLink(source: LinkSource): string | null {
  if (source.googleReviewUrl) return source.googleReviewUrl;
  if (source.googlePlaceId) {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(source.googlePlaceId)}`;
  }
  return null;
}

export function instagramLink(source: LinkSource): string | null {
  if (!source.instagramUsername) return null;
  return `https://www.instagram.com/${source.instagramUsername.replace(/^@/, "")}/`;
}

export function facebookLink(source: LinkSource): string | null {
  if (!source.facebookPageUrl) return null;
  const raw = source.facebookPageUrl.trim();
  // Accept either a full URL or a bare page name/id.
  const base = /^https?:\/\//i.test(raw) ? raw.replace(/\/+$/, "") : `https://www.facebook.com/${raw.replace(/^\/+/, "")}`;
  return base.includes("/reviews") ? base : `${base}/reviews`;
}

export function youtubeLink(source: LinkSource): string | null {
  if (!source.youtubeUrl) return null;
  const raw = source.youtubeUrl.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  // Accept a bare handle ("@myshop") or channel name.
  return `https://www.youtube.com/${raw.startsWith("@") ? raw : `@${raw}`}`;
}

export function websiteLink(source: LinkSource): string | null {
  if (!source.website) return null;
  const raw = source.website.trim();
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export function resolveChannelUrl(source: LinkSource, channel: ReviewChannel): string | null {
  switch (channel) {
    case ReviewChannel.GOOGLE:
      return googleReviewLink(source);
    case ReviewChannel.INSTAGRAM:
      return instagramLink(source);
    case ReviewChannel.FACEBOOK:
      return facebookLink(source);
    case ReviewChannel.YOUTUBE:
      return youtubeLink(source);
    case ReviewChannel.WEBSITE:
      return websiteLink(source);
    default:
      return null;
  }
}

// Which channels this business has actually configured, in display order.
export function availableChannels(source: LinkSource): ReviewChannel[] {
  const order: ReviewChannel[] = [
    ReviewChannel.GOOGLE,
    ReviewChannel.INSTAGRAM,
    ReviewChannel.FACEBOOK,
    ReviewChannel.YOUTUBE,
    ReviewChannel.WEBSITE,
  ];
  return order.filter((channel) => resolveChannelUrl(source, channel));
}

function assertOwnerOrAdmin(actor: Actor, ownerId: string): void {
  if (actor.role === UserRole.ADMIN) return;
  if (actor.sub !== ownerId) throw AppError.forbidden("You do not own this business");
}

export async function getReviewLinks(actor: Actor, businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");
  assertOwnerOrAdmin(actor, business.ownerId);

  const scans = await prisma.reviewScan.groupBy({
    by: ["channel"],
    where: { businessId },
    _count: { _all: true },
  });

  return {
    slug: business.slug,
    googlePlaceId: business.googlePlaceId,
    googleReviewUrl: business.googleReviewUrl,
    instagramUsername: business.instagramUsername,
    facebookPageUrl: business.facebookPageUrl,
    youtubeUrl: business.youtubeUrl,
    website: business.website,
    preferredReviewChannel: business.preferredReviewChannel,
    resolved: {
      GOOGLE: googleReviewLink(business),
      INSTAGRAM: instagramLink(business),
      FACEBOOK: facebookLink(business),
      YOUTUBE: youtubeLink(business),
      WEBSITE: websiteLink(business),
    },
    scanCounts: Object.fromEntries(scans.map((s) => [s.channel, s._count._all])) as Record<string, number>,
    totalScans: scans.reduce((sum, s) => sum + s._count._all, 0),
  };
}

export async function updateReviewLinks(actor: Actor, businessId: string, data: ReviewLinksInput) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");
  assertOwnerOrAdmin(actor, business.ownerId);

  const merged = { ...business, ...data };
  // A preferred channel is only meaningful if that channel is configured.
  if (data.preferredReviewChannel && !resolveChannelUrl(merged, data.preferredReviewChannel)) {
    throw AppError.badRequest(
      `Add your ${data.preferredReviewChannel.toLowerCase()} details before making it the default review channel`,
    );
  }

  await prisma.business.update({ where: { id: businessId }, data });
  return getReviewLinks(actor, businessId);
}

// Public: resolve where a scan should land, and record it. Returns null when
// nothing is configured so the caller can show a friendly fallback.
export async function resolveScan(
  slug: string,
  requested: ReviewChannel | undefined,
  userAgent?: string,
): Promise<{ url: string; channel: ReviewChannel } | null> {
  const business = await prisma.business.findUnique({ where: { slug } });
  if (!business) throw AppError.notFound("Business not found");

  const channels = availableChannels(business);
  if (channels.length === 0) return null;

  // Explicit request wins, then the shop's preference, then whatever exists.
  const channel =
    (requested && resolveChannelUrl(business, requested) ? requested : undefined) ??
    (business.preferredReviewChannel && resolveChannelUrl(business, business.preferredReviewChannel)
      ? business.preferredReviewChannel
      : undefined) ??
    channels[0];

  const url = resolveChannelUrl(business, channel);
  if (!url) return null;

  // Analytics must never block the redirect.
  prisma.reviewScan
    .create({ data: { businessId: business.id, channel, userAgent } })
    .catch(() => undefined);

  return { url, channel };
}

export async function getScanStats(actor: Actor, businessId: string, days = 30) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");
  assertOwnerOrAdmin(actor, business.ownerId);

  const since = new Date();
  since.setDate(since.getDate() - days);

  const [byChannel, recent, total] = await Promise.all([
    prisma.reviewScan.groupBy({ by: ["channel"], where: { businessId }, _count: { _all: true } }),
    prisma.reviewScan.count({ where: { businessId, scannedAt: { gte: since } } }),
    prisma.reviewScan.count({ where: { businessId } }),
  ]);

  return {
    total,
    recent,
    days,
    byChannel: Object.fromEntries(byChannel.map((s) => [s.channel, s._count._all])) as Record<string, number>,
  };
}
