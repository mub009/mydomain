import { z } from "zod";
import { ReviewChannel } from "@prisma/client";

// Empty strings clear a field, so the form can unset a platform.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const updateReviewLinksSchema = z.object({
  // e.g. ChIJN1t_tDeuEmsRUsoyG83frY4
  googlePlaceId: optionalText(255),
  googleReviewUrl: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .max(500)
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  instagramUsername: optionalText(100),
  facebookPageUrl: optionalText(500),
  youtubeUrl: optionalText(500),
  preferredReviewChannel: z.nativeEnum(ReviewChannel).nullable().optional(),
});

export const scanQuerySchema = z.object({
  // Optional destination override; falls back to the shop's default.
  c: z.enum(["google", "instagram", "facebook", "youtube", "website"]).optional(),
});
