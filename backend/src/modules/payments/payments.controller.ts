import { Request, Response } from "express";
import { ok } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as paymentsService from "./payments.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function createBookingPaymentHandler(req: Request, res: Response): Promise<void> {
  ok(res, await paymentsService.createBookingPaymentIntent(actor(req).sub, req.body.bookingId));
}

export async function createSubscriptionCheckoutHandler(req: Request, res: Response): Promise<void> {
  const { priceId, successUrl, cancelUrl } = req.body;
  ok(res, await paymentsService.createSubscriptionCheckoutSession(actor(req).sub, priceId, successUrl, cancelUrl));
}

export async function listMyPaymentsHandler(req: Request, res: Response): Promise<void> {
  ok(res, await paymentsService.listMyPayments(actor(req).sub));
}

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") throw AppError.badRequest("Missing stripe-signature header");
  await paymentsService.handleStripeWebhook(req.body as Buffer, signature);
  res.status(200).json({ received: true });
}
