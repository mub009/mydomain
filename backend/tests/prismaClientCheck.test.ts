import { describe, expect, it } from "vitest";
import { findGaps } from "@/config/prismaClientCheck";

// `prisma migrate deploy` updates the database but does not regenerate the
// client, so a server can end up running code that reads models and enums its
// client has never heard of. That used to surface as a bare TypeError —
// "Cannot read properties of undefined (reading 'WEBSITE')".
describe("findGaps", () => {
  // Stand-ins for a fully generated client.
  const currentRuntime = {
    UserRole: {},
    BusinessStatus: {},
    LeadStatus: {},
    SiteType: {},
    OrderStatus: {},
    OrderPaymentMethod: {},
    ReviewChannel: {},
    PosterSize: {},
  };
  const currentClient = {
    user: {},
    business: {},
    businessSite: {},
    product: {},
    order: {},
    orderItem: {},
    reviewQrCode: {},
    posterDesign: {},
  };

  it("reports nothing when the client is current", () => {
    expect(findGaps(currentRuntime, currentClient)).toEqual([]);
  });

  it("names the enum a pre-storefront client is missing", () => {
    const { SiteType, ...stale } = currentRuntime;
    void SiteType;
    expect(findGaps(stale, currentClient)).toContain("enum SiteType");
  });

  it("names every missing model and enum, not just the first", () => {
    const gaps = findGaps({}, {});
    expect(gaps).toContain("enum SiteType");
    expect(gaps).toContain("enum OrderStatus");
    expect(gaps).toContain("model product");
    expect(gaps).toContain("model order");
    expect(gaps.length).toBeGreaterThan(5);
  });

  // The whole point is telling the operator what to run, so the gap list has
  // to survive into a message — an empty list would say nothing.
  it("distinguishes a missing model from a missing enum", () => {
    const { product, ...withoutProduct } = currentClient;
    void product;
    expect(findGaps(currentRuntime, withoutProduct)).toEqual(["model product"]);
  });
});

// The model/enum checks pass happily for a migration that only adds columns —
// which is how "Unknown field `bandStyle` for select statement" reached a
// user's browser after the models had all existed for weeks.
describe("findGaps — fields", () => {
  const runtime = {
    UserRole: {},
    BusinessStatus: {},
    LeadStatus: {},
    SiteType: {},
    OrderStatus: {},
    OrderPaymentMethod: {},
    ReviewChannel: {},
    PosterSize: {},
  };
  const client = {
    user: {},
    business: {},
    businessSite: {},
    product: {},
    order: {},
    orderItem: {},
    reviewQrCode: {},
    posterDesign: {},
  };

  const current = {
    BusinessSite: ["siteType", "templateId"],
    Business: ["preferredReviewChannel"],
    WhatsappSession: ["dailyLimit", "sendDelayMs", "windowStartHour", "autoOptOut"],
    PosterDesign: ["artworkUrl", "headerText", "footerText", "logoPosition", "bandStyle", "bandColor", "aiPrompt", "qrPosition"],
  };

  it("reports nothing when every field is generated", () => {
    expect(findGaps(runtime, client, current)).toEqual([]);
  });

  it("names the column a client generated before the last migration lacks", () => {
    const stale = { ...current, PosterDesign: current.PosterDesign.filter((f) => !f.startsWith("band")) };
    expect(findGaps(runtime, client, stale)).toEqual(["field PosterDesign.bandStyle", "field PosterDesign.bandColor"]);
  });

  // Without a datamodel there is nothing to compare against; claiming every
  // field is missing would turn a readable message into noise.
  it("says nothing about fields when the datamodel could not be read", () => {
    expect(findGaps(runtime, client)).toEqual([]);
    expect(findGaps(runtime, client, {})).toEqual([]);
  });

  it("does not repeat a model it cannot see as a pile of missing fields", () => {
    const { posterDesign, ...withoutModel } = client;
    void posterDesign;
    const { PosterDesign, ...withoutFields } = current;
    void PosterDesign;
    expect(findGaps(runtime, withoutModel, withoutFields)).toEqual(["model posterDesign"]);
  });
});
