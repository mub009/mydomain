import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "@/common/asyncHandler";
import { requireAuth, requireRole } from "@/middleware/auth";
import {
  approveBusinessHandler,
  listPendingBusinessesHandler,
  platformStatsHandler,
  rejectBusinessHandler,
  suspendBusinessHandler,
} from "./admin.controller";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(UserRole.ADMIN));

adminRouter.get("/businesses/pending", asyncHandler(listPendingBusinessesHandler));
adminRouter.post("/businesses/:id/approve", asyncHandler(approveBusinessHandler));
adminRouter.post("/businesses/:id/reject", asyncHandler(rejectBusinessHandler));
adminRouter.post("/businesses/:id/suspend", asyncHandler(suspendBusinessHandler));
adminRouter.get("/stats", asyncHandler(platformStatsHandler));
