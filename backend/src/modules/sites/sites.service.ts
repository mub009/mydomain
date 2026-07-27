import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { buildTemplate, DEFAULT_TEMPLATE_ID, isKnownTemplate, templateChoices } from "./templates";
import { sanitizeSiteCss, sanitizeSiteHtml } from "./sanitize";

interface Actor {
  sub: string;
  role: UserRole;
}

// Everything the builder needs to seed a first draft from what the owner
// already entered in their listing.
const BUSINESS_FOR_TEMPLATE = {
  include: {
    category: true,
    photos: { orderBy: { sortOrder: "asc" } },
    hours: { orderBy: { dayOfWeek: "asc" } },
    services: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
  },
} satisfies Prisma.BusinessDefaultArgs;

function assertOwnerOrAdmin(actor: Actor, ownerId: string): void {
  if (actor.role === UserRole.ADMIN) return;
  if (actor.sub !== ownerId) throw AppError.forbidden("You do not own this business");
}

async function loadBusiness(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId }, ...BUSINESS_FOR_TEMPLATE });
  if (!business) throw AppError.notFound("Business not found");
  return business;
}

// Open the editor for a business. On first visit there is no saved document,
// so we hand back a starter page built from the listing's own data — name,
// contact details, opening hours, services and photos — which the owner then
// edits. Nothing is persisted until they save.
//
// `templateId` lets the editor preview a different design without committing
// to it; when omitted the business's own saved choice is used.
export async function getSiteForEditor(actor: Actor, businessId: string, templateId?: string) {
  const business = await loadBusiness(businessId);
  assertOwnerOrAdmin(actor, business.ownerId);

  const site = await prisma.businessSite.findUnique({ where: { businessId } });
  const selectedId = templateId ?? site?.templateId ?? DEFAULT_TEMPLATE_ID;
  const starter = buildTemplate(business, selectedId);

  return {
    businessId,
    slug: business.slug,
    // Null until the owner saves for the first time.
    projectData: site?.projectData ?? null,
    isPublished: site?.isPublished ?? false,
    publishedAt: site?.publishedAt ?? null,
    updatedAt: site?.updatedAt ?? null,
    hasSavedDraft: !!site,
    // What the site is saved as, vs. what this response was rendered with.
    templateId: site?.templateId ?? DEFAULT_TEMPLATE_ID,
    renderedTemplateId: starter.templateId,
    templates: templateChoices(),
    starterHtml: starter.html,
    starterCss: starter.css,
    // Handy for "reset to my account data" in the editor.
    businessData: starter.data,
  };
}

/**
 * Renders one of the designs for a business without saving it, so the picker
 * can preview a template before the owner commits to it.
 */
export async function previewTemplate(actor: Actor, businessId: string, templateId: string) {
  const business = await loadBusiness(businessId);
  assertOwnerOrAdmin(actor, business.ownerId);

  if (!isKnownTemplate(templateId)) throw AppError.badRequest(`Unknown website template "${templateId}"`);

  const built = buildTemplate(business, templateId);
  return { templateId: built.templateId, html: built.html, css: built.css };
}

export async function saveSite(
  actor: Actor,
  businessId: string,
  data: { projectData?: unknown; html?: string; css?: string; templateId?: string },
) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");
  assertOwnerOrAdmin(actor, business.ownerId);

  if (data.templateId && !isKnownTemplate(data.templateId)) {
    throw AppError.badRequest(`Unknown website template "${data.templateId}"`);
  }

  // The rendered output is served on our own origin, so strip anything
  // executable before it is stored. The editor document is kept as authored —
  // it is only ever loaded back into the builder, never rendered as a page.
  const payload = {
    projectData: (data.projectData ?? Prisma.DbNull) as Prisma.InputJsonValue,
    html: data.html ? sanitizeSiteHtml(data.html) : null,
    css: data.css ? sanitizeSiteCss(data.css) : null,
    // Only overwritten when the editor actually applied a template, so an
    // ordinary content save keeps the design the owner already picked.
    ...(data.templateId ? { templateId: data.templateId } : {}),
  };

  const site = await prisma.businessSite.upsert({
    where: { businessId },
    create: { businessId, templateId: data.templateId ?? DEFAULT_TEMPLATE_ID, ...payload },
    update: payload,
  });

  return { savedAt: site.updatedAt, isPublished: site.isPublished, templateId: site.templateId };
}

export async function setPublished(actor: Actor, businessId: string, isPublished: boolean) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");
  assertOwnerOrAdmin(actor, business.ownerId);

  const site = await prisma.businessSite.findUnique({ where: { businessId } });
  if (!site) throw AppError.badRequest("Save your website before publishing it");
  if (isPublished && !site.html) {
    throw AppError.badRequest("There is nothing to publish yet — add some content and save first");
  }

  const updated = await prisma.businessSite.update({
    where: { businessId },
    data: { isPublished, publishedAt: isPublished ? new Date() : null },
  });

  return {
    isPublished: updated.isPublished,
    publishedAt: updated.publishedAt,
    url: `/site/${business.slug}`,
  };
}

// Public: the rendered page for a published site. Returns null when the shop
// has no site or has unpublished it, so the caller can 404 cleanly.
export async function getPublishedSite(slug: string) {
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, city: true, description: true },
  });
  if (!business) throw AppError.notFound("Business not found");

  const site = await prisma.businessSite.findUnique({ where: { businessId: business.id } });
  if (!site || !site.isPublished || !site.html) return null;

  return {
    business,
    html: site.html,
    css: site.css ?? "",
    publishedAt: site.publishedAt,
  };
}
