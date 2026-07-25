import { z } from "zod";
import { createBusinessSchema } from "@/modules/businesses/businesses.validation";

// Full owner details captured by the dealer at the point of registration.
const ownerSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().min(7).max(20).optional(),
  password: z.string().min(8).max(72),
});

// The registration fee the dealer collects for onboarding the shop.
const paymentSchema = z.object({
  amount: z.number().positive().max(10_000_000), // in rupees; converted to paise/cents server-side
  currency: z.string().length(3).default("INR"),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER"]).default("CASH"),
  notes: z.string().max(500).optional(),
});

export const registerShopSchema = z.object({
  owner: ownerSchema,
  business: createBusinessSchema,
  payment: paymentSchema,
});

export const listRegistrationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().max(150).optional(),
});
