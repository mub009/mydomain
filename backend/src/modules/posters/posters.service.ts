import { Business, Category, PosterDesign, PosterSize, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";
import { inlineImage } from "./assets";
import { layoutChoices, POSTER_SIZES, renderPosterSvg, sizeChoices } from "./layouts";
import { PALETTES, resolvePalette } from "./palettes";
import { fillPlaceholders, PLACEHOLDERS, PosterSubject, unknownPlaceholders } from "./placeholders";
import { CopyBrief, claudeConfigured, suggestCopy, TONES } from "./copywriter";

interface Actor {
  sub: string;
  role: UserRole;
}

type BusinessForPoster = Business & { category: Category | null };

const BUSINESS_SELECT = { include: { category: true } } as const;

function toSubject(business: BusinessForPoster): PosterSubject {
  return {
    name: business.name,
    phone: business.phone,
    city: business.city,
    state: business.state,
    category: business.category?.name ?? "",
    address: [business.addressLine1, business.addressLine2].filter(Boolean).join(", "),
    website: business.website,
    email: business.email,
    logoUrl: business.logoUrl,
    avgRating: business.avgRating,
    reviewCount: business.reviewCount,
    slug: business.slug,
  };
}

/**
 * A subheadline reading "Rated by happy customers" — the shape left after a
 * shop with no reviews has its placeholders filled — is worse than no
 * subheadline. Drop a line whose placeholders all resolved to nothing.
 */
function keepIfSubstantial(original: string, filled: string): string {
  if (!original.includes("{{")) return filled;
  const words = filled.replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean);
  return words.length >= 3 ? filled : "";
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderedPoster {
  designId: string;
  name: string;
  layout: string;
  palette: string;
  size: PosterSize;
  width: number;
  height: number;
  svg: string;
  fileName: string;
  /** True when the shop's logo made it into the artwork; false means the
   *  poster fell back to a monogram, which is worth telling them. */
  logoEmbedded: boolean;
}

function fileNameFor(design: { name: string }, subject: PosterSubject): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return `${slug(subject.slug || subject.name)}-${slug(design.name) || "poster"}.svg`;
}

/** Draws one design for one business. */
export async function renderForBusiness(design: PosterDesign, business: BusinessForPoster): Promise<RenderedPoster> {
  const subject = toSubject(business);

  const [logoHref, backgroundHref] = await Promise.all([
    inlineImage(business.logoUrl),
    inlineImage(design.backgroundImageUrl),
  ]);

  const copy = {
    headline: fillPlaceholders(design.headline, subject),
    subheadline: keepIfSubstantial(design.subheadline ?? "", fillPlaceholders(design.subheadline, subject)),
    ctaText: fillPlaceholders(design.ctaText, subject),
    badgeText: fillPlaceholders(design.badgeText, subject),
    footnote: keepIfSubstantial(design.footnote ?? "", fillPlaceholders(design.footnote, subject)),
  };

  const { svg, width, height } = renderPosterSvg(
    {
      size: design.size,
      palette: resolvePalette(design.palette),
      copy,
      subject,
      logoHref,
      backgroundHref,
    },
    design.layout,
  );

  return {
    designId: design.id,
    name: design.name,
    layout: design.layout,
    palette: design.palette,
    size: design.size,
    width,
    height,
    svg,
    fileName: fileNameFor(design, subject),
    logoEmbedded: logoHref !== null,
  };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface DesignInput {
  name: string;
  description?: string | null;
  layout: string;
  palette: string;
  size: PosterSize;
  headline: string;
  subheadline?: string | null;
  ctaText?: string | null;
  badgeText?: string | null;
  footnote?: string | null;
  backgroundImageUrl?: string | null;
  categoryId?: string | null;
  city?: string | null;
  isPublished?: boolean;
  aiBrief?: string | null;
  aiEngine?: string | null;
}

function warningsFor(input: Partial<DesignInput>): string[] {
  const unknown = unknownPlaceholders(input.headline, input.subheadline, input.ctaText, input.badgeText, input.footnote);
  return unknown.map((token) => `Nothing will fill {{${token}}} — it will print as written.`);
}

export async function listDesigns(query: { page?: number; pageSize?: number; search?: string; published?: boolean }) {
  const { page, pageSize, skip } = parsePagination(query);
  const term = query.search?.trim();

  const where: Prisma.PosterDesignWhereInput = {
    ...(query.published === undefined ? {} : { isPublished: query.published }),
    ...(term ? { OR: [{ name: { contains: term } }, { headline: { contains: term } }] } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.posterDesign.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { renders: true } },
      },
    }),
    prisma.posterDesign.count({ where }),
  ]);

  const downloads = await prisma.posterRender.groupBy({
    by: ["designId"],
    where: { designId: { in: items.map((d) => d.id) } },
    _sum: { downloads: true },
  });
  const byDesign = new Map(downloads.map((row) => [row.designId, row._sum.downloads ?? 0]));

  return {
    items: items.map((design) => ({
      ...design,
      businessesUsing: design._count.renders,
      downloads: byDesign.get(design.id) ?? 0,
      warnings: warningsFor(design),
    })),
    meta: { page, pageSize, total },
  };
}

export async function getDesign(id: string) {
  const design = await prisma.posterDesign.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!design) throw AppError.notFound("Poster design not found");
  return { ...design, warnings: warningsFor(design) };
}

async function assertCategoryExists(categoryId: string | null | undefined): Promise<void> {
  if (!categoryId) return;
  const found = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!found) throw AppError.badRequest("That category does not exist");
}

export async function createDesign(actor: Actor, input: DesignInput) {
  await assertCategoryExists(input.categoryId);
  const design = await prisma.posterDesign.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      layout: input.layout,
      palette: input.palette,
      size: input.size,
      headline: input.headline,
      subheadline: input.subheadline ?? null,
      ctaText: input.ctaText ?? null,
      badgeText: input.badgeText ?? null,
      footnote: input.footnote ?? null,
      backgroundImageUrl: input.backgroundImageUrl ?? null,
      categoryId: input.categoryId ?? null,
      city: input.city?.trim() || null,
      isPublished: input.isPublished ?? false,
      aiBrief: input.aiBrief ?? null,
      aiEngine: input.aiEngine ?? null,
      createdById: actor.sub,
    },
  });
  return { ...design, warnings: warningsFor(design) };
}

export async function updateDesign(id: string, input: Partial<DesignInput>) {
  const existing = await prisma.posterDesign.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Poster design not found");
  if (input.categoryId !== undefined) await assertCategoryExists(input.categoryId);

  const design = await prisma.posterDesign.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.layout !== undefined ? { layout: input.layout } : {}),
      ...(input.palette !== undefined ? { palette: input.palette } : {}),
      ...(input.size !== undefined ? { size: input.size } : {}),
      ...(input.headline !== undefined ? { headline: input.headline } : {}),
      ...(input.subheadline !== undefined ? { subheadline: input.subheadline } : {}),
      ...(input.ctaText !== undefined ? { ctaText: input.ctaText } : {}),
      ...(input.badgeText !== undefined ? { badgeText: input.badgeText } : {}),
      ...(input.footnote !== undefined ? { footnote: input.footnote } : {}),
      ...(input.backgroundImageUrl !== undefined ? { backgroundImageUrl: input.backgroundImageUrl } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.city !== undefined ? { city: input.city?.trim() || null } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      ...(input.aiBrief !== undefined ? { aiBrief: input.aiBrief } : {}),
      ...(input.aiEngine !== undefined ? { aiEngine: input.aiEngine } : {}),
    },
  });
  return { ...design, warnings: warningsFor(design) };
}

export async function deleteDesign(id: string): Promise<void> {
  const existing = await prisma.posterDesign.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw AppError.notFound("Poster design not found");
  await prisma.posterDesign.delete({ where: { id } });
}

/**
 * Renders an unsaved design against a real listing. The editor calls this on
 * every change, so an admin sees a shop's actual logo and number in the
 * artwork before the design reaches anyone.
 */
export async function previewDesign(input: DesignInput, businessId?: string): Promise<RenderedPoster> {
  const business = businessId
    ? await prisma.business.findUnique({ where: { id: businessId }, ...BUSINESS_SELECT })
    : await prisma.business.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { reviewCount: "desc" },
        ...BUSINESS_SELECT,
      });

  if (!business) throw AppError.badRequest("No business available to preview against");

  // A draft record, never written — `renderForBusiness` only reads fields.
  const draft = {
    id: "preview",
    name: input.name,
    description: input.description ?? null,
    layout: input.layout,
    palette: input.palette,
    size: input.size,
    headline: input.headline,
    subheadline: input.subheadline ?? null,
    ctaText: input.ctaText ?? null,
    badgeText: input.badgeText ?? null,
    footnote: input.footnote ?? null,
    backgroundImageUrl: input.backgroundImageUrl ?? null,
  } as PosterDesign;

  return renderForBusiness(draft, business);
}

/** Listings the admin can preview against, newest first. */
export async function previewBusinesses(search?: string) {
  const term = search?.trim();
  return prisma.business.findMany({
    where: term ? { OR: [{ name: { contains: term } }, { city: { contains: term } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, name: true, city: true, logoUrl: true, category: { select: { name: true } } },
  });
}

export async function aiSuggest(brief: CopyBrief) {
  return suggestCopy(brief);
}

/** Everything the editor needs to build its pickers in one call. */
export function studioOptions() {
  return {
    layouts: layoutChoices(),
    palettes: PALETTES.map(({ id, name, bg, accent, ink, dark }) => ({ id, name, bg, accent, ink, dark })),
    sizes: sizeChoices(),
    placeholders: PLACEHOLDERS,
    tones: TONES,
    // So the editor can label the button honestly rather than implying a
    // model is involved when the phrase bank is doing the work.
    ai: { engine: claudeConfigured() ? "claude" : "offline" },
  };
}

/** Which businesses have used a design, for the usage report. */
export async function designUsage(id: string) {
  await getDesign(id);
  return prisma.posterRender.findMany({
    where: { designId: id },
    orderBy: { lastAt: "desc" },
    take: 100,
    include: { business: { select: { id: true, name: true, city: true } } },
  });
}

// ---------------------------------------------------------------------------
// Business side
// ---------------------------------------------------------------------------

async function accessibleBusiness(actor: Actor, businessId: string): Promise<BusinessForPoster> {
  const business = await prisma.business.findUnique({ where: { id: businessId }, ...BUSINESS_SELECT });
  if (!business) throw AppError.notFound("Business not found");
  if (actor.role !== UserRole.ADMIN && business.ownerId !== actor.sub) {
    throw AppError.forbidden("You do not own this business");
  }
  return business;
}

/**
 * The published designs this shop is entitled to. A design with no targeting
 * goes to everyone; one with a category or city set goes only to matching
 * shops, so a salon is not handed a poster written for a garage.
 */
export async function listForBusiness(actor: Actor, businessId: string) {
  const business = await accessibleBusiness(actor, businessId);

  const designs = await prisma.posterDesign.findMany({
    where: {
      isPublished: true,
      AND: [
        { OR: [{ categoryId: null }, { categoryId: business.categoryId }] },
        { OR: [{ city: null }, { city: business.city }] },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: { category: { select: { name: true } } },
  });

  const renders = await prisma.posterRender.findMany({
    where: { businessId, designId: { in: designs.map((d) => d.id) } },
    select: { designId: true, downloads: true, lastAt: true },
  });
  const byDesign = new Map(renders.map((r) => [r.designId, r]));

  return {
    business: { id: business.id, name: business.name, logoUrl: business.logoUrl, hasLogo: Boolean(business.logoUrl) },
    designs: designs.map((design) => ({
      id: design.id,
      name: design.name,
      description: design.description,
      layout: design.layout,
      palette: design.palette,
      size: design.size,
      dimensions: POSTER_SIZES[design.size],
      updatedAt: design.updatedAt,
      forCategory: design.category?.name ?? null,
      forCity: design.city,
      downloads: byDesign.get(design.id)?.downloads ?? 0,
      lastDownloadedAt: byDesign.get(design.id)?.lastAt ?? null,
    })),
  };
}

async function publishedDesignFor(business: BusinessForPoster, designId: string): Promise<PosterDesign> {
  const design = await prisma.posterDesign.findUnique({ where: { id: designId } });
  if (!design || !design.isPublished) throw AppError.notFound("Poster not found");
  // Targeting is an entitlement, not just a filter — re-check it here so a
  // guessed id cannot fetch a poster meant for a different trade or town.
  if (design.categoryId && design.categoryId !== business.categoryId) throw AppError.notFound("Poster not found");
  if (design.city && design.city !== business.city) throw AppError.notFound("Poster not found");
  return design;
}

export async function renderForOwner(actor: Actor, businessId: string, designId: string): Promise<RenderedPoster> {
  const business = await accessibleBusiness(actor, businessId);
  return renderForBusiness(await publishedDesignFor(business, designId), business);
}

/** Counted when the shop actually saves the file, not when it previews one. */
export async function recordDownload(actor: Actor, businessId: string, designId: string) {
  const business = await accessibleBusiness(actor, businessId);
  await publishedDesignFor(business, designId);

  const render = await prisma.posterRender.upsert({
    where: { designId_businessId: { designId, businessId } },
    create: { designId, businessId, downloads: 1 },
    update: { downloads: { increment: 1 }, lastAt: new Date() },
  });
  return { downloads: render.downloads };
}
