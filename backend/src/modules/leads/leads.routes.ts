import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { optionalAuth, requireAuth } from "@/middleware/auth";
import { createLeadSchema, listLeadsQuerySchema, updateLeadStatusSchema } from "./leads.validation";
import { createLeadHandler, listLeadsHandler, updateLeadStatusHandler } from "./leads.controller";

export const leadsRouter = Router();

leadsRouter.post(
  "/businesses/:businessId/leads",
  optionalAuth,
  validate({ body: createLeadSchema }),
  asyncHandler(createLeadHandler),
);
leadsRouter.get(
  "/businesses/:businessId/leads",
  requireAuth,
  validate({ query: listLeadsQuerySchema }),
  asyncHandler(listLeadsHandler),
);
leadsRouter.patch(
  "/leads/:leadId/status",
  requireAuth,
  validate({ body: updateLeadStatusSchema }),
  asyncHandler(updateLeadStatusHandler),
);
