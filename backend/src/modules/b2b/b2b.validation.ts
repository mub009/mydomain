import { z } from "zod";

export const createRfqSchema = z.object({
  categoryId: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(4000),
  quantity: z.number().int().min(1).default(1),
  budgetCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).default("INR"),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  deadline: z.coerce.date().optional(),
});

export const listRfqsQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  city: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

export const createQuoteSchema = z.object({
  businessId: z.string().uuid(),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3).default("INR"),
  message: z.string().max(2000).optional(),
  deliveryDays: z.number().int().min(0).optional(),
});

export const inviteSupplierSchema = z.object({
  businessId: z.string().uuid(),
});
