import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric with hyphens"),
  description: z.string().max(500).optional(),
  iconUrl: z.string().url().optional(),
  parentId: z.string().uuid().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();
