import { classicTemplate } from "./classic";
import { elegantTemplate } from "./elegant";
import { modernTemplate } from "./modern";
import { summariseHours, buildContext, BusinessWithDetails, SiteTemplate } from "./shared";
import { vibrantTemplate } from "./vibrant";

// Order matters — this is the order the picker shows them in, and the first
// entry is what a business gets before it has chosen anything.
export const SITE_TEMPLATES: SiteTemplate[] = [
  classicTemplate,
  modernTemplate,
  elegantTemplate,
  vibrantTemplate,
];

export const DEFAULT_TEMPLATE_ID = SITE_TEMPLATES[0].id;

/** Falls back to the default rather than throwing: a template that was
 *  renamed or retired must not lock an owner out of their own editor. */
export function resolveTemplate(templateId?: string | null): SiteTemplate {
  return SITE_TEMPLATES.find((t) => t.id === templateId) ?? SITE_TEMPLATES[0];
}

export function isKnownTemplate(templateId: string): boolean {
  return SITE_TEMPLATES.some((t) => t.id === templateId);
}

/** The catalogue the picker renders — everything but the builder itself. */
export function templateChoices() {
  return SITE_TEMPLATES.map(({ id, name, description, accent, bestFor }) => ({
    id,
    name,
    description,
    accent,
    bestFor,
  }));
}

/**
 * Renders a business's data through one of the designs. This is what seeds a
 * first draft in the builder, and what "apply this template" produces.
 */
export function buildTemplate(business: BusinessWithDetails, templateId?: string | null) {
  const template = resolveTemplate(templateId);
  const ctx = buildContext(business);
  const { html, css } = template.build(ctx);

  return {
    templateId: template.id,
    html,
    css,
    // Echoed back to the editor so it can show what it drew the page from.
    data: {
      name: business.name,
      tagline: business.category?.name ? `${business.category.name} in ${business.city}` : business.city,
      description: business.description ?? "",
      phone: business.phone,
      email: business.email,
      address: [business.addressLine1, business.addressLine2, business.city, business.state, business.postalCode]
        .filter(Boolean)
        .join(", "),
      workingTime: summariseHours(business.hours),
      instagram: business.instagramUsername ?? null,
      logoUrl: business.logoUrl,
      photoCount: business.photos.length,
      slideCount: ctx.slides.length,
      serviceCount: business.services.length,
    },
  };
}

export type { BusinessWithDetails, SiteTemplate } from "./shared";
