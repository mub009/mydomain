import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth, requireRole } from "@/middleware/auth";
import { createQuoteSchema, createRfqSchema, inviteSupplierSchema, listRfqsQuerySchema } from "./b2b.validation";
import {
  awardQuoteHandler,
  closeRfqHandler,
  createRfqHandler,
  getRfqHandler,
  inviteSupplierHandler,
  listMyRfqsHandler,
  listRfqsHandler,
  submitQuoteHandler,
} from "./b2b.controller";

export const b2bRouter = Router();

b2bRouter.get("/rfqs", validate({ query: listRfqsQuerySchema }), asyncHandler(listRfqsHandler));
b2bRouter.get("/rfqs/mine", requireAuth, asyncHandler(listMyRfqsHandler));
b2bRouter.get("/rfqs/:id", asyncHandler(getRfqHandler));

b2bRouter.post("/rfqs", requireAuth, validate({ body: createRfqSchema }), asyncHandler(createRfqHandler));
b2bRouter.post("/rfqs/:id/close", requireAuth, asyncHandler(closeRfqHandler));
b2bRouter.post(
  "/rfqs/:id/invites",
  requireAuth,
  validate({ body: inviteSupplierSchema }),
  asyncHandler(inviteSupplierHandler),
);
b2bRouter.post(
  "/rfqs/:id/quotes",
  requireAuth,
  requireRole(UserRole.BUSINESS_OWNER, UserRole.ADMIN),
  validate({ body: createQuoteSchema }),
  asyncHandler(submitQuoteHandler),
);
b2bRouter.post("/rfqs/:id/quotes/:quoteId/award", requireAuth, asyncHandler(awardQuoteHandler));
