import { describe, expect, it } from "vitest";
import { ReviewChannel } from "@prisma/client";
import {
  availableChannels,
  markkitoLink,
  markkitoReviewLink,
  resolveChannelUrl,
} from "@/modules/reviewqr/reviewqr.service";
import { env } from "@/config/env";

const origin = env.CLIENT_ORIGIN;

// A listing with nothing connected — the state most shops are in on day one.
const bare = {
  slug: "spice-route-kitchen",
  googlePlaceId: null,
  googleReviewUrl: null,
  instagramUsername: null,
  facebookPageUrl: null,
  youtubeUrl: null,
  website: null,
  latitude: null,
  longitude: null,
};

describe("Markkito QR channels", () => {
  it("builds both destinations from the slug alone", () => {
    expect(markkitoLink(bare)).toBe(`${origin}/business/spice-route-kitchen`);
    expect(markkitoReviewLink(bare)).toBe(`${origin}/business/spice-route-kitchen?review=1`);
  });

  // The point of these two: no Google place id, no Instagram handle, nothing —
  // a board assigned by a dealer works the moment the listing exists.
  it("resolves for a shop that has connected nothing", () => {
    expect(resolveChannelUrl(bare, ReviewChannel.MARKKITO)).toBeTruthy();
    expect(resolveChannelUrl(bare, ReviewChannel.MARKKITO_REVIEW)).toBeTruthy();
    expect(resolveChannelUrl(bare, ReviewChannel.GOOGLE)).toBeNull();
    expect(availableChannels(bare)).toEqual([ReviewChannel.MARKKITO_REVIEW, ReviewChannel.MARKKITO]);
  });

  it("returns nothing without a slug", () => {
    expect(markkitoLink({ ...bare, slug: null })).toBeNull();
    expect(markkitoReviewLink({ ...bare, slug: null })).toBeNull();
  });

  // availableChannels[0] is the fallback for a board with no channel set, so
  // adding the Markkito options must not quietly redirect existing boards.
  it("keeps Google ahead of Markkito in the fallback order", () => {
    const configured = { ...bare, googlePlaceId: "abc123", latitude: 11.2, longitude: 75.7 };
    const channels = availableChannels(configured);

    expect(channels[0]).toBe(ReviewChannel.GOOGLE);
    expect(channels.indexOf(ReviewChannel.MARKKITO)).toBeGreaterThan(channels.indexOf(ReviewChannel.DIRECTIONS));
  });
});
