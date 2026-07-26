import { z } from "zod";
import { ReviewChannel, ReviewQrStatus } from "@prisma/client";

export const generateBatchSchema = z.object({
  count: z.number().int().min(1).max(500),
  batchLabel: z.string().trim().max(100).optional(),
  // Purpose picked from the list; omitted means "use the shop's default".
  channel: z.nativeEnum(ReviewChannel).optional(),
});

export const listQrCodesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  status: z.nativeEnum(ReviewQrStatus).optional(),
  search: z.string().max(100).optional(),
  batchLabel: z.string().max(100).optional(),
});

export const claimCodeSchema = z.object({
  code: z.string().trim().min(4).max(20),
  businessId: z.string().uuid(),
  channel: z.nativeEnum(ReviewChannel).optional(),
});

export const setBoardChannelSchema = z.object({
  channel: z.nativeEnum(ReviewChannel).nullable(),
});

// Kept as a plain object (no .refine) because the validate middleware needs a
// ZodObject; "at least one field" is enforced in the service.
export const updateQrCodeSchema = z.object({
  status: z.nativeEnum(ReviewQrStatus).optional(),
  businessId: z.string().uuid().nullable().optional(),
  channel: z.nativeEnum(ReviewChannel).nullable().optional(),
});
