import { Business, Category, PosterDesign, PosterSize, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";
import { inlineImage } from "./assets";
import {
  BAND_STYLES,
  layoutChoices,
  LOGO_POSITIONS,
  POSTER_SIZES,
  renderPosterSvg,
  resolveBandStyle,
  resolveLogoPosition,
  sizeChoices,
} from "./layouts";
import { PALETTES, resolvePalette } from "./palettes";
import {
  fillPlaceholders,
  PLACEHOLDERS,
  PosterSubject,
  promptWantsQr,
  qrCornerFromPrompt,
  unknownPlaceholders,
} from "./placeholders";
import { BandBrief, CopyBrief, claudeConfigured, suggestBands, suggestCopy, TONES } from "./copywriter";
import { MAX_ARTWORK_BYTES } from "./upload";
import { businessQrDataUrl } from "./qr";
import { generatePosterImage, ImageEngineId, openAiConfigured } from "./imageEngine";
import { markkitoLink } from "@/modules/reviewqr/reviewqr.service";

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
    // Built by the same helper the printed review boards use, so there is one
    // definition of where a business lives.
    pageUrl: markkitoLink({ slug: business.slug }) ?? "",
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

  // A design with uploaded artwork uses it as the image; anything else falls
  // back to the background field the drawn layouts use.
  const [logoHref, backgroundHref, qrHref] = await Promise.all([
    inlineImage(business.logoUrl),
    inlineImage(design.artworkUrl ?? design.backgroundImageUrl),
    promptWantsQr(design.aiPrompt) ? businessQrDataUrl(business.slug) : Promise.resolve(null),
  ]);

  const copy = {
    headline: fillPlaceholders(design.headline, subject),
    subheadline: keepIfSubstantial(design.subheadline ?? "", fillPlaceholders(design.subheadline, subject)),
    ctaText: fillPlaceholders(design.ctaText, subject),
    badgeText: fillPlaceholders(design.badgeText, subject),
    footnote: keepIfSubstantial(design.footnote ?? "", fillPlaceholders(design.footnote, subject)),
    headerText: keepIfSubstantial(design.headerText ?? "", fillPlaceholders(design.headerText, subject)),
    footerText: keepIfSubstantial(design.footerText ?? "", fillPlaceholders(design.footerText, subject)),
  };

  const { svg, width, height } = renderPosterSvg(
    {
      size: design.size,
      palette: resolvePalette(design.palette),
      copy,
      subject,
      logoHref,
      backgroundHref,
      showHeader: design.showHeader,
      showFooter: design.showFooter,
      logoPosition: resolveLogoPosition(design.logoPosition),
      logoScale: design.logoScale,
      bandStyle: resolveBandStyle(design.bandStyle),
      bandColor: design.bandColor,
      bandTextColor: design.bandTextColor,
      qrHref,
      qrPosition: qrCornerFromPrompt(design.aiPrompt),
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
  layout?: string;
  palette?: string;
  size?: PosterSize;
  headline?: string | null;
  subheadline?: string | null;
  ctaText?: string | null;
  badgeText?: string | null;
  footnote?: string | null;
  backgroundImageUrl?: string | null;
  artworkUrl?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  showHeader?: boolean;
  showFooter?: boolean;
  logoPosition?: string;
  logoScale?: number;
  bandStyle?: string;
  bandColor?: string | null;
  bandTextColor?: string | null;
  categoryId?: string | null;
  city?: string | null;
  isPublished?: boolean;
  aiPrompt?: string | null;
  aiEngine?: string | null;
}

function warningsFor(input: Partial<DesignInput>): string[] {
  const unknown = unknownPlaceholders(
    input.headline,
    input.subheadline,
    input.ctaText,
    input.badgeText,
    input.footnote,
    input.headerText,
    input.footerText,
  );
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
      // Every field except `artworkUrl`, which holds an uploaded image inline
      // and would put megabytes per row into a list nobody renders it from.
      // The list reports whether there is artwork; the editor fetches it.
      select: {
        id: true,
        name: true,
        description: true,
        layout: true,
        palette: true,
        size: true,
        headline: true,
        subheadline: true,
        ctaText: true,
        badgeText: true,
        footnote: true,
        backgroundImageUrl: true,
        headerText: true,
        footerText: true,
        showHeader: true,
        showFooter: true,
        logoPosition: true,
        logoScale: true,
        bandStyle: true,
        bandColor: true,
        bandTextColor: true,
        categoryId: true,
        city: true,
        isPublished: true,
        aiPrompt: true,
        aiEngine: true,
        createdAt: true,
        updatedAt: true,
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

  const reach = await reachCounts(items);

  const withArtwork = new Set(
    (
      await prisma.posterDesign.findMany({
        where: { id: { in: items.map((d) => d.id) }, NOT: { artworkUrl: null } },
        select: { id: true },
      })
    ).map((d) => d.id),
  );

  return {
    items: items.map((design) => ({
      ...design,
      hasArtwork: withArtwork.has(design.id),
      reach: reach.get(design.id) ?? 0,
      showQr: promptWantsQr(design.aiPrompt),
      qrCorner: promptWantsQr(design.aiPrompt) ? qrCornerFromPrompt(design.aiPrompt) : null,
      businessesUsing: design._count.renders,
      downloads: byDesign.get(design.id) ?? 0,
      warnings: warningsFor(design),
    })),
    meta: { page, pageSize, total },
  };
}

/**
 * How many listings each design actually reaches.
 *
 * Targeting is easy to get wrong — pick the category that reads right in the
 * design's name rather than the one its shops are filed under, and every
 * Posters tab it was meant for stays empty with nothing to explain why. This
 * applies the *same* rule the shop side uses, so the number an admin sees is
 * the number of shops that can really open it, and a zero is visible at the
 * moment the poster is filed rather than after a complaint.
 */
async function reachCounts(designs: { id: string; categoryId: string | null; city: string | null }[]) {
  const counts = new Map<string, number>();
  if (designs.length === 0) return counts;

  // One grouped read rather than a count per row: the number of distinct
  // category/city pairs is small however many listings there are.
  const groups = await prisma.business.groupBy({ by: ["categoryId", "city"], _count: { _all: true } });

  for (const design of designs) {
    let total = 0;
    for (const group of groups) {
      if (design.categoryId && group.categoryId !== design.categoryId) continue;
      if (design.city && group.city !== design.city) continue;
      total += group._count._all;
    }
    counts.set(design.id, total);
  }
  return counts;
}

/** The same count for a design being written, before it is saved. */
export async function reachFor(categoryId: string | null, city: string | null): Promise<number> {
  const counts = await reachCounts([{ id: "draft", categoryId, city }]);
  return counts.get("draft") ?? 0;
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
      // An uploaded file is the normal case now; the drawn layouts are only
      // reached by naming one explicitly.
      layout: input.layout ?? "artwork",
      palette: input.palette ?? "crimson",
      size: input.size ?? "PORTRAIT",
      headline: input.headline ?? null,
      subheadline: input.subheadline ?? null,
      ctaText: input.ctaText ?? null,
      badgeText: input.badgeText ?? null,
      footnote: input.footnote ?? null,
      backgroundImageUrl: input.backgroundImageUrl ?? null,
      artworkUrl: input.artworkUrl ?? null,
      headerText: input.headerText ?? null,
      footerText: input.footerText ?? null,
      showHeader: input.showHeader ?? true,
      showFooter: input.showFooter ?? true,
      logoPosition: input.logoPosition ?? "header",
      logoScale: input.logoScale ?? 1,
      bandStyle: input.bandStyle ?? "gradient",
      bandColor: input.bandColor ?? null,
      bandTextColor: input.bandTextColor ?? null,
      categoryId: input.categoryId ?? null,
      city: input.city?.trim() || null,
      isPublished: input.isPublished ?? false,
      aiPrompt: input.aiPrompt ?? null,
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
      ...(input.artworkUrl !== undefined ? { artworkUrl: input.artworkUrl } : {}),
      ...(input.headerText !== undefined ? { headerText: input.headerText } : {}),
      ...(input.footerText !== undefined ? { footerText: input.footerText } : {}),
      ...(input.showHeader !== undefined ? { showHeader: input.showHeader } : {}),
      ...(input.showFooter !== undefined ? { showFooter: input.showFooter } : {}),
      ...(input.logoPosition !== undefined ? { logoPosition: input.logoPosition } : {}),
      ...(input.logoScale !== undefined ? { logoScale: input.logoScale } : {}),
      ...(input.bandStyle !== undefined ? { bandStyle: input.bandStyle } : {}),
      ...(input.bandColor !== undefined ? { bandColor: input.bandColor } : {}),
      ...(input.bandTextColor !== undefined ? { bandTextColor: input.bandTextColor } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.city !== undefined ? { city: input.city?.trim() || null } : {}),
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      ...(input.aiPrompt !== undefined ? { aiPrompt: input.aiPrompt } : {}),
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
    layout: input.layout ?? "artwork",
    palette: input.palette ?? "crimson",
    size: input.size ?? "PORTRAIT",
    headline: input.headline ?? null,
    subheadline: input.subheadline ?? null,
    ctaText: input.ctaText ?? null,
    badgeText: input.badgeText ?? null,
    footnote: input.footnote ?? null,
    backgroundImageUrl: input.backgroundImageUrl ?? null,
    artworkUrl: input.artworkUrl ?? null,
    headerText: input.headerText ?? null,
    footerText: input.footerText ?? null,
    showHeader: input.showHeader ?? true,
    showFooter: input.showFooter ?? true,
    logoPosition: input.logoPosition ?? "header",
    logoScale: input.logoScale ?? 1,
    bandStyle: input.bandStyle ?? "gradient",
    bandColor: input.bandColor ?? null,
    bandTextColor: input.bandTextColor ?? null,
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

/**
 * The prompt with a real shop's details filled in.
 *
 * The stored prompt is the template — "@business_name in @city, phone
 * @phone" — and this is what it becomes for one business. It is what an image
 * generator would be sent, and what the editor previews so the admin can see
 * the tokens resolve before saving.
 */
export async function resolvePrompt(prompt: string, businessId?: string) {
  const business = businessId
    ? await prisma.business.findUnique({ where: { id: businessId }, ...BUSINESS_SELECT })
    : await prisma.business.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { reviewCount: "desc" },
        ...BUSINESS_SELECT,
      });

  if (!business) throw AppError.badRequest("No business available to resolve against");

  return {
    business: { id: business.id, name: business.name, city: business.city },
    prompt,
    resolved: fillPlaceholders(prompt, toSubject(business)),
    unknown: unknownPlaceholders(prompt),
  };
}

export async function aiSuggest(brief: CopyBrief) {
  return suggestCopy(brief);
}

export async function aiBands(brief: BandBrief) {
  return suggestBands(brief);
}

/** Everything the editor needs to build its pickers in one call. */
export async function studioOptions() {
  // Listings per category, so the editor can say how many shops a poster will
  // reach while the category is still being chosen.
  const byCategory = await prisma.business.groupBy({ by: ["categoryId"], _count: { _all: true } });

  return {
    reach: {
      all: byCategory.reduce((sum, row) => sum + row._count._all, 0),
      byCategory: Object.fromEntries(
        byCategory.filter((row) => row.categoryId).map((row) => [row.categoryId as string, row._count._all]),
      ),
    },
    layouts: layoutChoices(),
    palettes: PALETTES.map(({ id, name, bg, accent, ink, dark }) => ({ id, name, bg, accent, ink, dark })),
    sizes: sizeChoices(),
    logoPositions: LOGO_POSITIONS.map(({ id, label }) => ({ id, label })),
    bandStyles: BAND_STYLES.map(({ id, label, hint }) => ({ id, label, hint })),
    maxArtworkBytes: MAX_ARTWORK_BYTES,
    placeholders: PLACEHOLDERS,
    tones: TONES,
    // So the editor can label the button honestly rather than implying a
    // model is involved when the phrase bank is doing the work.
    ai: { engine: claudeConfigured() ? "claude" : "offline" },
    imageEngine: openAiConfigured() ? "openai" : "local",
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
    select: { designId: true, downloads: true, lastAt: true, generatedAt: true },
  });
  const byDesign = new Map(renders.map((r) => [r.designId, r]));

  return {
    business: {
      id: business.id,
      name: business.name,
      logoUrl: business.logoUrl,
      hasLogo: Boolean(business.logoUrl),
      // So an empty list can name the trade it found nothing for, instead of
      // leaving the shop to guess which of its details decided that.
      category: business.category?.name ?? null,
      city: business.city,
    },
    designs: designs.map((design) => ({
      id: design.id,
      name: design.name,
      description: design.description,
      layout: design.layout,
      palette: design.palette,
      size: design.size,
      dimensions: POSTER_SIZES[design.size],
      updatedAt: design.updatedAt,
      hasArtwork: Boolean(design.artworkUrl),
      forCategory: design.category?.name ?? null,
      forCity: design.city,
      downloads: byDesign.get(design.id)?.downloads ?? 0,
      lastDownloadedAt: byDesign.get(design.id)?.lastAt ?? null,
      generatedAt: byDesign.get(design.id)?.generatedAt ?? null,
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

/**
 * The shop's finished poster, made from the admin's master template.
 *
 * Kept once made: compositing is cheap enough to repeat, but an image model
 * costs money and seconds per poster, so the first result is stored and reused
 * until the shop asks for a new one.
 */
export async function generateForOwner(
  actor: Actor,
  businessId: string,
  designId: string,
  options: { regenerate?: boolean } = {},
) {
  const business = await accessibleBusiness(actor, businessId);
  const design = await publishedDesignFor(business, designId);

  const existing = await prisma.posterRender.findUnique({
    where: { designId_businessId: { designId, businessId } },
  });
  // A copy made before the admin last touched the design is the *old* design.
  // Without this the artwork could be replaced and every shop that had already
  // opened the poster would keep the picture it was withdrawn for.
  const current = existing?.generatedAt != null && existing.generatedAt >= design.updatedAt;
  if (existing?.imageUrl && current && !options.regenerate) {
    return {
      image: existing.imageUrl,
      engine: (existing.engine ?? "local") as ImageEngineId,
      generatedAt: existing.generatedAt,
      reused: true,
      dimensions: POSTER_SIZES[design.size],
    };
  }

  const composited = await renderForBusiness(design, business);
  const generated = await generatePosterImage({
    template: await inlineImage(design.artworkUrl),
    prompt: fillPlaceholders(design.aiPrompt, toSubject(business)),
    composited: { svg: composited.svg, width: composited.width, height: composited.height },
  });

  const saved = await prisma.posterRender.upsert({
    where: { designId_businessId: { designId, businessId } },
    create: {
      designId,
      businessId,
      imageUrl: generated.image,
      engine: generated.engine,
      generatedAt: new Date(),
    },
    update: { imageUrl: generated.image, engine: generated.engine, generatedAt: new Date() },
  });

  return {
    image: generated.image,
    engine: generated.engine,
    note: generated.note,
    generatedAt: saved.generatedAt,
    reused: false,
    dimensions: { width: generated.width, height: generated.height },
  };
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
