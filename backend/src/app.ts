import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { apiRateLimit } from "@/middleware/rateLimit";
import { errorHandler, notFoundHandler } from "@/middleware/error";
import { asyncHandler } from "@/common/asyncHandler";
import { authRouter } from "@/modules/auth/auth.routes";
import { categoriesRouter } from "@/modules/categories/categories.routes";
import { businessesRouter } from "@/modules/businesses/businesses.routes";
import { searchRouter } from "@/modules/search/search.routes";
import { reviewsRouter } from "@/modules/reviews/reviews.routes";
import { leadsRouter } from "@/modules/leads/leads.routes";
import { bookingsRouter } from "@/modules/bookings/bookings.routes";
import { paymentsRouter } from "@/modules/payments/payments.routes";
import { stripeWebhookHandler } from "@/modules/payments/payments.controller";
import { b2bRouter } from "@/modules/b2b/b2b.routes";
import { adminRouter } from "@/modules/admin/admin.routes";
import { usersRouter } from "@/modules/users/users.routes";
import { pointsRouter } from "@/modules/points/points.routes";
import { visitorsRouter } from "@/modules/visitors/visitors.routes";
import { qrCodesRouter, reviewLinksRouter, reviewScanRouter } from "@/modules/reviewqr/reviewqr.routes";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== "test" }));

  // Stripe webhook needs the raw request body for signature verification,
  // so it must be registered before the global JSON body parser.
  app.post("/api/v1/payments/webhook", express.raw({ type: "application/json" }), asyncHandler(stripeWebhookHandler));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use("/api", apiRateLimit);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/categories", categoriesRouter);
  app.use("/api/v1/businesses", businessesRouter);
  app.use("/api/v1/search", searchRouter);
  app.use("/api/v1", reviewsRouter);
  app.use("/api/v1", leadsRouter);
  app.use("/api/v1", bookingsRouter);
  app.use("/api/v1/payments", paymentsRouter);
  app.use("/api/v1/b2b", b2bRouter);
  app.use("/api/v1/admin", adminRouter);
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/points", pointsRouter);
  app.use("/api/v1/visitors", visitorsRouter);
  app.use("/api/v1/businesses", reviewLinksRouter);
  app.use("/api/v1/qr-codes", qrCodesRouter);
  // Short public path for the printed QR board: https://host/r/<slug>
  app.use("/r", reviewScanRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
