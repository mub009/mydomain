import { z } from "zod";
import { PosterSize } from "@prisma/client";
import { POSTER_LAYOUTS } from "./layouts";
import { PALETTES } from "./palettes";
import { TONES } from "./copywriter";

const layoutIds = POSTER_LAYOUTS.map((l) => l.id) as [string, ...string[]];
const paletteIds = PALETTES.map((p) => p.id) as [string, ...string[]];

// The background is drawn into artwork that shops re-share, so only real
// image URLs — `javascript:` and `data:` have no business here.
const imageUrl = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "Must be an http(s) URL");

const hexColor = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Must be a hex colour like #b8860b");

const designFields = {
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  // Presentation now has defaults, so the admin form does not have to carry
  // any of it: a Phase 1 poster is a name, a category, an image and a prompt.
  layout: z.enum(layoutIds).optional(),
  palette: z.enum(paletteIds).optional(),
  size: z.nativeEnum(PosterSize).optional(),
  headline: z.string().trim().max(200).nullable().optional(),
  subheadline: z.string().trim().max(300).nullable().optional(),
  ctaText: z.string().trim().max(60).nullable().optional(),
  badgeText: z.string().trim().max(40).nullable().optional(),
  footnote: z.string().trim().max(160).nullable().optional(),
  backgroundImageUrl: imageUrl.nullable().optional(),
  // Either an http(s) URL or the data URI returned by the upload endpoint.
  // Only raster types — an SVG here would be a document embedded in a
  // document the platform serves.
  artworkUrl: z
    .string()
    .trim()
    .max(6_000_000)
    .refine(
      (value) => /^https?:\/\//i.test(value) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value),
      "Must be an http(s) URL or an uploaded PNG, JPEG, WebP or GIF",
    )
    .nullable()
    .optional(),
  headerText: z.string().trim().max(160).nullable().optional(),
  footerText: z.string().trim().max(200).nullable().optional(),
  showHeader: z.boolean().optional(),
  showFooter: z.boolean().optional(),
  logoPosition: z.enum(["header", "top-left", "top-right", "bottom-left", "bottom-right", "center", "none"]).optional(),
  logoScale: z.coerce.number().min(0.5).max(2).optional(),
  bandStyle: z.enum(["solid", "gradient", "glass", "none"]).optional(),
  // Hex only — these values go straight into an SVG fill attribute.
  bandColor: hexColor.nullable().optional(),
  bandTextColor: hexColor.nullable().optional(),
  qrPosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]).optional(),
  qrScale: z.coerce.number().min(0.5).max(2).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  isPublished: z.boolean().optional(),
  // Kept with the poster for reference and for regenerating it later, so it
  // has room for a real brief rather than a phrase.
  aiPrompt: z.string().trim().max(4000).nullable().optional(),
  aiEngine: z.enum(["offline", "claude"]).nullable().optional(),
};

export const createDesignSchema = z.object(designFields);

export const updateDesignSchema = z.object({
  ...designFields,
  name: designFields.name.optional(),
});

export const listDesignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().max(100).optional(),
  published: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const previewSchema = z.object({
  ...designFields,
  businessId: z.string().uuid().optional(),
});

export const aiBriefSchema = z.object({
  occasion: z.string().trim().max(80).optional(),
  tone: z.enum(TONES),
  category: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  offer: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(600).optional(),
  count: z.coerce.number().int().min(1).max(5).default(3),
});

export const bandBriefSchema = z.object({
  prompt: z.string().trim().min(3).max(600),
  count: z.coerce.number().int().min(1).max(5).default(3),
});

export const resolvePromptSchema = z.object({
  prompt: z.string().max(4000),
  businessId: z.string().uuid().optional(),
});

export const previewBusinessQuerySchema = z.object({
  search: z.string().max(100).optional(),
});
