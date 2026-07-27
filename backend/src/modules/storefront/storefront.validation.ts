import { z } from "zod";
import { OrderStatus } from "@prisma/client";

// `z.string().url()` alone accepts anything with a scheme — including
// `javascript:` and `data:`. Product images are rendered straight into an
// <img src>, so only real web URLs are allowed through.
const url = z
  .string()
  .url()
  .max(2048)
  .refine((value) => /^https?:$/.test(new URL(value).protocol), "Image URL must start with http:// or https://");

export const createProductSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters").max(160),
  description: z.string().max(4000).optional().nullable(),
  priceCents: z.number().int().min(0, "Price cannot be negative").max(100_000_000),
  compareAtCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
  currency: z.string().length(3).optional(),
  imageUrl: url.optional().nullable(),
  sku: z.string().max(60).optional().nullable(),
  trackStock: z.boolean().optional(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1, "Quantity must be at least 1").max(999),
      }),
    )
    .min(1, "Add at least one item to your cart")
    .max(100),
  customerName: z.string().min(2, "Please enter your name").max(120),
  customerPhone: z.string().min(7, "Please enter a valid phone number").max(20),
  customerEmail: z.string().email("Please enter a valid email").max(160).optional(),
  addressLine1: z.string().min(3, "Please enter your delivery address").max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(2, "Please enter your city").max(120),
  postalCode: z.string().max(20).optional(),
  notes: z.string().max(1000).optional(),
});

export const orderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

// Storefront settings live alongside the site, so they are saved with it.
export const storefrontSettingsSchema = z.object({
  deliveryFeeCents: z.number().int().min(0).max(10_000_000).optional(),
  freeDeliveryAboveCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
});
