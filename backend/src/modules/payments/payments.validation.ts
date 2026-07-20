import { z } from "zod";

export const createBookingPaymentSchema = z.object({
  bookingId: z.string().uuid(),
});

export const createSubscriptionCheckoutSchema = z.object({
  priceId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});
