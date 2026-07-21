import { z } from "zod";

export const createBusinessSchema = z.object({
  name: z.string().min(2).max(150),
  slug: z
    .string()
    .min(2)
    .max(150)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  categoryId: z.string().uuid(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20),
  website: z.string().url().optional(),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(2).max(2).default("IN"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  logoUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
});

export const updateBusinessSchema = createBusinessSchema.partial();

export const addPhotoSchema = z.object({
  url: z.string().url(),
  caption: z.string().max(200).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const setHoursSchema = z.object({
  hours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        openTime: z.string().regex(/^\d{2}:\d{2}$/),
        closeTime: z.string().regex(/^\d{2}:\d{2}$/),
        isClosed: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(7),
});

export const createServiceSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(1000).optional(),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3).default("INR"),
  durationMins: z.number().int().min(5).max(1440).default(60),
});

export const updateServiceSchema = createServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listBusinessesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  categoryId: z.string().uuid().optional(),
  city: z.string().optional(),
  status: z.string().optional(),
});
