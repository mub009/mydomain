import { z } from "zod";

export const adjustPointsSchema = z.object({
  // Positive grants points, negative deducts them.
  amount: z.number().int().min(-1000).max(1000).refine((v) => v !== 0, "Amount must not be zero"),
  note: z.string().max(300).optional(),
});

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});
