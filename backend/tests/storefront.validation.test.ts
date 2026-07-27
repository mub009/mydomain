import { describe, expect, it } from "vitest";
import { checkoutSchema, createProductSchema } from "@/modules/storefront/storefront.validation";

// Checkout is open to guests, so its schema is the first thing standing
// between the public internet and an order row.
describe("checkoutSchema", () => {
  const validCart = {
    items: [{ productId: "p1", quantity: 2 }],
    customerName: "Anil Menon",
    customerPhone: "9812345678",
    addressLine1: "22 Beach Road",
    city: "Kozhikode",
  };

  it("accepts a minimal guest order", () => {
    const parsed = checkoutSchema.parse(validCart);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.customerEmail).toBeUndefined();
  });

  it("rejects an empty cart with a message a shopper can act on", () => {
    const result = checkoutSchema.safeParse({ ...validCart, items: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toMatch(/at least one item/i);
  });

  it("rejects zero and fractional quantities", () => {
    for (const quantity of [0, -1, 1.5]) {
      expect(checkoutSchema.safeParse({ ...validCart, items: [{ productId: "p1", quantity }] }).success).toBe(false);
    }
  });

  // Prices are never taken from the client, so a cart that tries to send one
  // must not be able to smuggle it through.
  it("strips any price sent by the browser", () => {
    const parsed = checkoutSchema.parse({
      ...validCart,
      items: [{ productId: "p1", quantity: 1, priceCents: 1 }],
    });
    expect(parsed.items[0]).toEqual({ productId: "p1", quantity: 1 });
  });

  it("requires a name, phone, address and city", () => {
    for (const field of ["customerName", "customerPhone", "addressLine1", "city"] as const) {
      expect(checkoutSchema.safeParse({ ...validCart, [field]: "" }).success).toBe(false);
    }
  });

  it("rejects a malformed email but allows it to be absent", () => {
    expect(checkoutSchema.safeParse({ ...validCart, customerEmail: "not-an-email" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...validCart, customerEmail: "a@b.dev" }).success).toBe(true);
  });
});

describe("createProductSchema", () => {
  const valid = { name: "Masala Dosa", priceCents: 12000 };

  it("accepts a name and price alone", () => {
    expect(createProductSchema.parse(valid)).toMatchObject(valid);
  });

  it("rejects a negative price", () => {
    expect(createProductSchema.safeParse({ ...valid, priceCents: -1 }).success).toBe(false);
  });

  // Free items are a real thing (samples, offers), so zero must be allowed.
  it("allows a price of zero", () => {
    expect(createProductSchema.safeParse({ ...valid, priceCents: 0 }).success).toBe(true);
  });

  it("rejects an image that is not a URL", () => {
    expect(createProductSchema.safeParse({ ...valid, imageUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(createProductSchema.safeParse({ ...valid, imageUrl: "https://cdn.test/a.jpg" }).success).toBe(true);
  });
});
