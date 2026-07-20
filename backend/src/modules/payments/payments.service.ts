import Stripe from "stripe";
import { PaymentStatus, PaymentType } from "@prisma/client";
import { prisma } from "@/config/database";
import { env } from "@/config/env";
import { AppError } from "@/common/errors";
import { logger } from "@/config/logger";

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" }) : null;

function requireStripe(): Stripe {
  if (!stripe) throw AppError.internal("Payment provider is not configured");
  return stripe;
}

export async function createBookingPaymentIntent(userId: string, bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw AppError.notFound("Booking not found");
  if (booking.customerId !== userId) throw AppError.forbidden("You do not own this booking");

  const existing = await prisma.payment.findUnique({ where: { bookingId } });
  if (existing && existing.status === PaymentStatus.SUCCEEDED) {
    throw AppError.conflict("Booking has already been paid for");
  }

  const client = requireStripe();
  const intent = await client.paymentIntents.create({
    amount: booking.priceCents,
    currency: booking.currency.toLowerCase(),
    metadata: { bookingId: booking.id, userId },
  });

  const payment = await prisma.payment.upsert({
    where: { bookingId },
    create: {
      userId,
      bookingId,
      type: PaymentType.BOOKING,
      amountCents: booking.priceCents,
      currency: booking.currency,
      providerPaymentIntent: intent.id,
    },
    update: { providerPaymentIntent: intent.id, status: PaymentStatus.PENDING },
  });

  return { clientSecret: intent.client_secret, payment };
}

export async function createSubscriptionCheckoutSession(userId: string, priceId: string, successUrl: string, cancelUrl: string) {
  const client = requireStripe();
  const session = await client.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userId,
  });
  return { checkoutUrl: session.url };
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
  const client = requireStripe();
  if (!env.STRIPE_WEBHOOK_SECRET) throw AppError.internal("Webhook secret not configured");

  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err }, "Invalid Stripe webhook signature");
    throw AppError.badRequest("Invalid webhook signature");
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      await prisma.payment.updateMany({
        where: { providerPaymentIntent: intent.id },
        data: { status: PaymentStatus.SUCCEEDED },
      });
      const payment = await prisma.payment.findFirst({ where: { providerPaymentIntent: intent.id } });
      if (payment?.bookingId) {
        await prisma.booking.update({ where: { id: payment.bookingId }, data: { status: "CONFIRMED" } });
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      await prisma.payment.updateMany({
        where: { providerPaymentIntent: intent.id },
        data: { status: PaymentStatus.FAILED },
      });
      break;
    }
    default:
      logger.debug({ type: event.type }, "Unhandled Stripe webhook event");
  }
}

export async function listMyPayments(userId: string) {
  return prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}
