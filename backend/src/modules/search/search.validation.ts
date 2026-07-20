import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z.string().max(150).optional(),
  categorySlug: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.5).max(100).default(10),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(["relevance", "rating", "distance", "newest"]).default("relevance"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
