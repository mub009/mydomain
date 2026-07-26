import { z } from "zod";

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(72),
});

export const listCreatedUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().max(150).optional(),
});
