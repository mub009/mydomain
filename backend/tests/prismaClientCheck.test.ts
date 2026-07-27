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
  };
  const currentClient = {
    user: {},
    business: {},
    businessSite: {},
    product: {},
    order: {},
    orderItem: {},
    reviewQrCode: {},
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
