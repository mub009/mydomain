import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth, requirePrivilege, requireRole } from "@/middleware/auth";
import { updateReviewLinksSchema } from "./reviewqr.validation";
import { claimCodeSchema, setBoardChannelSchema } from "./qrcodes.validation";
import { getReviewLinksHandler, updateReviewLinksHandler } from "./reviewqr.controller";
import {
  businessQrCodesHandler,
  claimCodeHandler,
  lookupCodeHandler,
  qrScanHandler,
  setBoardChannelHandler,
} from "./qrcodes.controller";

// Public redirect target for printed boards, at a short path so the encoded
// URL stays small and scans reliably: /r/q/<code>
export const reviewScanRouter = Router();
reviewScanRouter.get("/q/:code", asyncHandler(qrScanHandler));

// Shop-facing code lookup and claim.
export const qrCodesRouter = Router();
qrCodesRouter.get("/lookup/:code", asyncHandler(lookupCodeHandler));
qrCodesRouter.post(
  "/claim",
  requireAuth,
  requireRole(UserRole.BUSINESS_OWNER, UserRole.DEALER, UserRole.ADMIN),
  validate({ body: claimCodeSchema }),
  asyncHandler(claimCodeHandler),
);

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
reviewLinksRouter.get("/:id/qr-codes", requireAuth, asyncHandler(businessQrCodesHandler));
// Re-point one of the shop's boards at a different platform.
reviewLinksRouter.patch(
  "/:id/qr-codes/:qrId",
  requireAuth,
  listingPriv,
  validate({ body: setBoardChannelSchema }),
  asyncHandler(setBoardChannelHandler),
);
