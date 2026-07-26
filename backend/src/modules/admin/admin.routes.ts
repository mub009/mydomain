import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth, requireRole } from "@/middleware/auth";
import {
  approveBusinessHandler,
  businessCreatorsReportHandler,
  createUserHandler,
  listAllBusinessesHandler,
  listPendingBusinessesHandler,
  listUsersHandler,
  platformStatsHandler,
  reassignBusinessHandler,
  rejectBusinessHandler,
  suspendBusinessHandler,
  updateBusinessAsAdminHandler,
  updateUserHandler,
} from "./admin.controller";
import {
  createUserSchema,
  listBusinessesQuerySchema,
  listUsersQuerySchema,
  reassignBusinessSchema,
  updateBusinessSchema,
  updateUserSchema,
} from "./admin.validation";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(UserRole.ADMIN));

adminRouter.get("/stats", asyncHandler(platformStatsHandler));
adminRouter.get("/reports/business-creators", asyncHandler(businessCreatorsReportHandler));

// Users
adminRouter.get("/users", validate({ query: listUsersQuerySchema }), asyncHandler(listUsersHandler));
adminRouter.post("/users", validate({ body: createUserSchema }), asyncHandler(createUserHandler));
adminRouter.patch("/users/:id", validate({ body: updateUserSchema }), asyncHandler(updateUserHandler));

// Businesses
adminRouter.get("/businesses", validate({ query: listBusinessesQuerySchema }), asyncHandler(listAllBusinessesHandler));
adminRouter.get("/businesses/pending", asyncHandler(listPendingBusinessesHandler));
adminRouter.patch("/businesses/:id", validate({ body: updateBusinessSchema }), asyncHandler(updateBusinessAsAdminHandler));
adminRouter.post("/businesses/:id/approve", asyncHandler(approveBusinessHandler));
adminRouter.post("/businesses/:id/reject", asyncHandler(rejectBusinessHandler));
adminRouter.post("/businesses/:id/suspend", asyncHandler(suspendBusinessHandler));
adminRouter.post("/businesses/:id/reassign", validate({ body: reassignBusinessSchema }), asyncHandler(reassignBusinessHandler));
