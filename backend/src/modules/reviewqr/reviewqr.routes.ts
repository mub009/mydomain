import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth, requirePrivilege } from "@/middleware/auth";
import { scanQuerySchema, updateReviewLinksSchema } from "./reviewqr.validation";
import {
  getReviewLinksHandler,
  scanRedirectHandler,
  scanStatsHandler,
  updateReviewLinksHandler,
} from "./reviewqr.controller";

// Public redirect target for the printed QR board. Deliberately mounted at a
// short path ("/r/:slug") so the encoded URL stays small and scans reliably.
export const reviewScanRouter = Router();
reviewScanRouter.get("/:slug", validate({ query: scanQuerySchema }), asyncHandler(scanRedirectHandler));

// Owner-facing management, nested under the business it belongs to.
export const reviewLinksRouter = Router({ mergeParams: true });

const listingPriv = requirePrivilege("MANAGE_LISTINGS");

reviewLinksRouter.get("/:id/review-links", requireAuth, asyncHandler(getReviewLinksHandler));
reviewLinksRouter.patch(
  "/:id/review-links",
  requireAuth,
  listingPriv,
  validate({ body: updateReviewLinksSchema }),
  asyncHandler(updateReviewLinksHandler),
);
reviewLinksRouter.get("/:id/review-scans", requireAuth, asyncHandler(scanStatsHandler));
