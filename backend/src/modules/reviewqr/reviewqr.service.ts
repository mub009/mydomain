import { ReviewChannel, UserRole } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { env } from "@/config/env";

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
> & {
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // The listing's own slug, which is what the Markkito channels are built from.
  slug?: string | null;
};

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

// Turn-by-turn navigation to the shop. Built from the coordinates already on
// the listing, so it needs no setup from the owner and is always available.
export function directionsLink(source: LinkSource): string | null {
  if (source.latitude == null || source.longitude == null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${source.latitude},${source.longitude}`;
}

export function websiteLink(source: LinkSource): string | null {
  if (!source.website) return null;
  const raw = source.website.trim();
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

// The shop's own page on Markkito. Unlike every other channel this needs
// nothing from the owner — the slug exists as soon as the listing does — so a
// board pointed here works from the moment it is assigned.
export function markkitoLink(source: LinkSource): string | null {
  if (!source.slug) return null;
  return `${env.CLIENT_ORIGIN}/business/${source.slug}`;
}

// Same page, opened on the review composer, for boards whose whole purpose is
// collecting reviews on Markkito.
export function markkitoReviewLink(source: LinkSource): string | null {
  const base = markkitoLink(source);
  return base ? `${base}?review=1` : null;
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
    case ReviewChannel.DIRECTIONS:
      return directionsLink(source);
    case ReviewChannel.MARKKITO:
      return markkitoLink(source);
    case ReviewChannel.MARKKITO_REVIEW:
      return markkitoReviewLink(source);
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
    ReviewChannel.DIRECTIONS,
    // Last on purpose: these always resolve, so putting them earlier would
    // silently become the fallback for every board that has no channel set.
    ReviewChannel.MARKKITO_REVIEW,
    ReviewChannel.MARKKITO,
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
      DIRECTIONS: directionsLink(business),
      MARKKITO: markkitoLink(business),
      MARKKITO_REVIEW: markkitoReviewLink(business),
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
