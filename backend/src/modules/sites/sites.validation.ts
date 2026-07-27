import { z } from "zod";

// The builder's own document. Its shape is the editor's business, so it is
// stored as-is; only the size is bounded to keep a runaway document from
// filling the column.
export const saveSiteSchema = z.object({
  projectData: z.unknown().optional(),
  html: z.string().max(500_000).optional(),
  css: z.string().max(200_000).optional(),
  // Only sent when the owner applied a design; the id itself is checked
  // against the registry in the service.
  templateId: z.string().max(40).optional(),
});

export const publishSiteSchema = z.object({
  isPublished: z.boolean(),
});
