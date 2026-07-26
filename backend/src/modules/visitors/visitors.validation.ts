import { z } from "zod";

export const captureVisitorSchema = z.object({
  // Indian mobile numbers, with or without the +91 prefix.
  phone: z
    .string()
    .trim()
    .regex(/^(\+?91)?[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  city: z.string().max(100).optional(),
  // The popup requires an explicit tick before it will submit.
  consent: z.literal(true, { errorMap: () => ({ message: "You must accept the terms to continue" }) }),
});

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  city: z.string().max(100).optional(),
});

export const listVisitorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().max(100).optional(),
  withLocation: z.enum(["true", "false"]).optional(),
});
