import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { createBookingPaymentSchema, createSubscriptionCheckoutSchema } from "./payments.validation";
import { createBookingPaymentHandler, createSubscriptionCheckoutHandler, listMyPaymentsHandler } from "./payments.controller";

// Note: the Stripe webhook route is mounted separately in app.ts with a raw
// body parser (required for signature verification) before the global JSON
// body parser runs.
export const paymentsRouter = Router();

paymentsRouter.post(
  "/booking-intent",
  requireAuth,
  validate({ body: createBookingPaymentSchema }),
  asyncHandler(createBookingPaymentHandler),
);
paymentsRouter.post(
  "/subscription-checkout",
  requireAuth,
  validate({ body: createSubscriptionCheckoutSchema }),
  asyncHandler(createSubscriptionCheckoutHandler),
);
paymentsRouter.get("/mine", requireAuth, asyncHandler(listMyPaymentsHandler));
