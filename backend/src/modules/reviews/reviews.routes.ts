import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { createReviewSchema, replyReviewSchema } from "./reviews.validation";
import { createReviewHandler, deleteReviewHandler, listReviewsHandler, replyToReviewHandler } from "./reviews.controller";

export const reviewsRouter = Router({ mergeParams: true });

reviewsRouter.get("/businesses/:businessId/reviews", asyncHandler(listReviewsHandler));
reviewsRouter.post(
  "/businesses/:businessId/reviews",
  requireAuth,
  validate({ body: createReviewSchema }),
  asyncHandler(createReviewHandler),
);
reviewsRouter.post(
  "/reviews/:reviewId/reply",
  requireAuth,
  validate({ body: replyReviewSchema }),
  asyncHandler(replyToReviewHandler),
);
reviewsRouter.delete("/reviews/:reviewId", requireAuth, asyncHandler(deleteReviewHandler));
