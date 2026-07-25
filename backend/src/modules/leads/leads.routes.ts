import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { optionalAuth, requireAuth, requirePrivilege } from "@/middleware/auth";
import { createLeadSchema, listLeadsQuerySchema, updateLeadStatusSchema } from "./leads.validation";
import { createLeadHandler, listLeadsHandler, updateLeadStatusHandler } from "./leads.controller";

export const leadsRouter = Router();

const leadsPriv = requirePrivilege("MANAGE_LEADS");

leadsRouter.post(
  "/businesses/:businessId/leads",
  optionalAuth,
  validate({ body: createLeadSchema }),
  asyncHandler(createLeadHandler),
);
leadsRouter.get(
  "/businesses/:businessId/leads",
  requireAuth,
  leadsPriv,
  validate({ query: listLeadsQuerySchema }),
  asyncHandler(listLeadsHandler),
);
leadsRouter.patch(
  "/leads/:leadId/status",
  requireAuth,
  leadsPriv,
  validate({ body: updateLeadStatusSchema }),
  asyncHandler(updateLeadStatusHandler),
);
