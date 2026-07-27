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

/**
 * The palette each design contributes to a storefront. An eCommerce site is
 * rendered by the app rather than authored in the builder — the cart and
 * checkout have to actually run — so the template choice comes through as a
 * theme instead of as markup.
 */
export interface StorefrontTheme {
  accent: string;
  accentAlt: string;
  onAccent: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  line: string;
  headerBg: string;
  headerText: string;
  radius: string;
  font: string;
  heading: string;
  uppercase: boolean;
}

const SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

const STOREFRONT_THEMES: Record<string, StorefrontTheme> = {
  classic: {
    accent: "#e11d2e",
    accentAlt: "#b91626",
    onAccent: "#ffffff",
    bg: "#ffffff",
    surface: "#f6f8fb",
    text: "#12161c",
    muted: "#6b7280",
    line: "#e8edf3",
    headerBg: "#ffffff",
    headerText: "#12161c",
    radius: "12px",
    font: SANS,
    heading: SANS,
    uppercase: true,
  },
  modern: {
    accent: "#f5b301",
    accentAlt: "#ffc933",
    onAccent: "#0d1015",
    bg: "#0d1015",
    surface: "#161b22",
    text: "#e8edf4",
    muted: "#9aa6b6",
    line: "#242c37",
    headerBg: "#0d1015",
    headerText: "#ffffff",
    radius: "12px",
    font: SANS,
    heading: SANS,
    uppercase: true,
  },
  elegant: {
    accent: "#b08d5a",
    accentAlt: "#96754a",
    onAccent: "#ffffff",
    bg: "#faf7f2",
    surface: "#ffffff",
    text: "#2a251f",
    muted: "#7a7267",
    line: "#e6ddce",
    headerBg: "#faf7f2",
    headerText: "#2a251f",
    radius: "2px",
    font: SANS,
    heading: 'Georgia,"Times New Roman",serif',
    uppercase: true,
  },
  vibrant: {
    accent: "#7c3aed",
    accentAlt: "#ec4899",
    onAccent: "#ffffff",
    bg: "#ffffff",
    surface: "#faf8ff",
    text: "#1b1236",
    muted: "#6b6486",
    line: "#ece7f7",
    headerBg: "#ffffff",
    headerText: "#1b1236",
    radius: "22px",
    font: SANS,
    heading: SANS,
    uppercase: false,
  },
};

export function storefrontTheme(templateId?: string | null): StorefrontTheme {
  return STOREFRONT_THEMES[resolveTemplate(templateId).id] ?? STOREFRONT_THEMES[DEFAULT_TEMPLATE_ID];
}

/** The catalogue the picker renders — everything but the builder itself. */
export function templateChoices() {
  return SITE_TEMPLATES.map(({ id, name, description, accent, bestFor }) => ({
    id,
    name,
    description,
    accent,
    bestFor,
    theme: storefrontTheme(id),
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
