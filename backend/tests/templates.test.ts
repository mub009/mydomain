import { describe, expect, it } from "vitest";
import {
  buildTemplate,
  DEFAULT_TEMPLATE_ID,
  isKnownTemplate,
  resolveTemplate,
  SITE_TEMPLATES,
  templateChoices,
  type BusinessWithDetails,
} from "@/modules/sites/templates";
import { sanitizeSiteCss, sanitizeSiteHtml } from "@/modules/sites/sanitize";

// A listing with everything filled in. Only the fields the templates read are
// meaningful; the rest satisfy the Prisma type.
function makeBusiness(overrides: Partial<BusinessWithDetails> = {}): BusinessWithDetails {
  const base = {
    id: "biz-1",
    ownerId: "user-1",
    categoryId: "cat-1",
    name: "Tetra World",
    slug: "tetra-world",
    description: "Kitchen & home appliances since 1998.",
    phone: "+91 98765 43210",
    email: "hello@tetra.test",
    website: null,
    addressLine1: "12 MG Road",
    addressLine2: null,
    city: "Kozhikode",
    state: "Kerala",
    postalCode: "673001",
    country: "IN",
    latitude: 11.2588,
    longitude: 75.7804,
    logoUrl: "https://cdn.test/logo.png",
    coverImageUrl: null,
    status: "APPROVED",
    isVerified: true,
    isFeatured: false,
    avgRating: 4.6,
    reviewCount: 128,
    viewCount: 0,
    googlePlaceId: null,
    instagramUsername: "@tetraworld",
    facebookPageUrl: null,
    youtubeChannelUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: { id: "cat-1", name: "Home Appliances" },
    photos: [
      { id: "p1", url: "https://cdn.test/1.jpg", caption: "Showroom", sortOrder: 0 },
      { id: "p2", url: "https://cdn.test/2.jpg", caption: "Kitchen range", sortOrder: 1 },
      { id: "p3", url: "https://cdn.test/3.jpg", caption: null, sortOrder: 2 },
    ],
    hours: [
      { id: "h0", dayOfWeek: 0, openTime: "09:30", closeTime: "20:00", isClosed: true },
      { id: "h1", dayOfWeek: 1, openTime: "09:30", closeTime: "20:00", isClosed: false },
      { id: "h2", dayOfWeek: 2, openTime: "09:30", closeTime: "20:00", isClosed: false },
    ],
    services: [
      { id: "s1", name: "Installation", description: "At your doorstep", priceCents: 49900, currency: "INR" },
      { id: "s2", name: "Annual service", description: null, priceCents: 0, currency: "INR" },
    ],
  } as unknown as BusinessWithDetails;

  return { ...base, ...overrides };
}

describe("site template registry", () => {
  it("exposes unique ids and a default that resolves", () => {
    const ids = SITE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(isKnownTemplate(DEFAULT_TEMPLATE_ID)).toBe(true);
  });

  it("offers more than one design to choose from", () => {
    expect(SITE_TEMPLATES.length).toBeGreaterThan(1);
    for (const choice of templateChoices()) {
      expect(choice.name).toBeTruthy();
      expect(choice.description).toBeTruthy();
      expect(choice.bestFor).toBeTruthy();
      expect(choice.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  // A retired or mistyped id must not lock an owner out of their own editor.
  it("falls back to the default for an unknown id", () => {
    expect(resolveTemplate("does-not-exist").id).toBe(DEFAULT_TEMPLATE_ID);
    expect(resolveTemplate(null).id).toBe(DEFAULT_TEMPLATE_ID);
    expect(isKnownTemplate("does-not-exist")).toBe(false);
  });
});

describe.each(SITE_TEMPLATES.map((t) => [t.id] as const))("template %s", (id) => {
  it("renders every core section from the listing's data", () => {
    const { html, css, templateId } = buildTemplate(makeBusiness(), id);

    expect(templateId).toBe(id);
    expect(html).toContain("Tetra World");
    expect(html).toContain("Home Appliances");
    // Logo, sticky header, slideshow, map, WhatsApp float, enquiry form.
    expect(html).toContain('src="https://cdn.test/logo.png"');
    expect(html).toContain("mk-header");
    expect(css).toMatch(/\.mk-header\{[^}]*position:sticky/);
    expect(html).toContain("mk-track");
    expect(html).toContain("maps.google.com");
    expect(html).toContain("https://wa.me/919876543210");
    expect(html).toContain('data-mk-form="enquiry"');
    // Services and their prices.
    expect(html).toContain("Installation");
    expect(html).toContain("₹499");
    expect(html).toContain("Free");
  });

  it("falls back to a lettermark and placeholder slide with no photos or logo", () => {
    const { html } = buildTemplate(makeBusiness({ logoUrl: null, photos: [], services: [] }), id);

    expect(html).toContain("mk-logo-text");
    expect(html).toContain("mk-slide-empty");
    // No gallery or services section when there is nothing to show.
    expect(html).not.toContain('id="gallery"');
    expect(html).not.toContain('id="services"');
  });

  // Owner content is interpolated straight into markup, so it has to be escaped.
  it("escapes business-supplied text", () => {
    const { html } = buildTemplate(makeBusiness({ name: 'Bob\'s "Best" <b>Shop</b>' }), id);

    expect(html).not.toContain("<b>Shop</b>");
    expect(html).toContain("&lt;b&gt;Shop&lt;/b&gt;");
  });

  // Templates are stored through the same sanitizer as hand-edited pages, so
  // nothing the design relies on may be stripped on save.
  it("survives the save-time sanitizer intact", () => {
    const { html, css } = buildTemplate(makeBusiness(), id);
    const cleanHtml = sanitizeSiteHtml(html);
    const cleanCss = sanitizeSiteCss(css);

    expect(cleanHtml).toContain("maps.google.com");
    expect(cleanHtml).toContain("https://wa.me/919876543210");
    expect(cleanHtml).toContain('data-mk-form="enquiry"');
    expect(cleanHtml).toContain("<svg");
    expect(cleanCss).toContain("position:sticky");
    expect(cleanCss).toContain(".mk-float");
  });
});
