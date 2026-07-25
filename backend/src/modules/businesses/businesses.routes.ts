import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth, requirePrivilege, requireRole } from "@/middleware/auth";
import {
  addPhotoSchema,
  createBusinessSchema,
  createServiceSchema,
  listBusinessesQuerySchema,
  setHoursSchema,
  updateBusinessSchema,
  updateServiceSchema,
} from "./businesses.validation";
import {
  addPhotoHandler,
  addServiceHandler,
  createBusinessHandler,
  deleteBusinessHandler,
  deleteServiceHandler,
  getBusinessForOwnerHandler,
  getBusinessHandler,
  listBusinessesHandler,
  listMyBusinessesHandler,
  removePhotoHandler,
  setHoursHandler,
  submitForApprovalHandler,
  updateBusinessHandler,
  updateServiceHandler,
} from "./businesses.controller";

export const businessesRouter = Router();

businessesRouter.get("/", validate({ query: listBusinessesQuerySchema }), asyncHandler(listBusinessesHandler));
businessesRouter.get(
  "/mine",
  requireAuth,
  requireRole(UserRole.BUSINESS_OWNER, UserRole.DEALER, UserRole.ADMIN),
  asyncHandler(listMyBusinessesHandler),
);
businessesRouter.get("/:id/manage", requireAuth, asyncHandler(getBusinessForOwnerHandler));
businessesRouter.get("/:slug", asyncHandler(getBusinessHandler));

const listingPriv = requirePrivilege("MANAGE_LISTINGS");

businessesRouter.post(
  "/",
  requireAuth,
  requireRole(UserRole.BUSINESS_OWNER, UserRole.DEALER, UserRole.ADMIN),
  listingPriv,
  validate({ body: createBusinessSchema }),
  asyncHandler(createBusinessHandler),
);
businessesRouter.patch("/:id", requireAuth, listingPriv, validate({ body: updateBusinessSchema }), asyncHandler(updateBusinessHandler));
businessesRouter.delete("/:id", requireAuth, listingPriv, asyncHandler(deleteBusinessHandler));
businessesRouter.post("/:id/submit", requireAuth, listingPriv, asyncHandler(submitForApprovalHandler));

businessesRouter.post("/:id/photos", requireAuth, listingPriv, validate({ body: addPhotoSchema }), asyncHandler(addPhotoHandler));
businessesRouter.delete("/:id/photos/:photoId", requireAuth, listingPriv, asyncHandler(removePhotoHandler));

businessesRouter.put("/:id/hours", requireAuth, listingPriv, validate({ body: setHoursSchema }), asyncHandler(setHoursHandler));

businessesRouter.post("/:id/services", requireAuth, listingPriv, validate({ body: createServiceSchema }), asyncHandler(addServiceHandler));
businessesRouter.patch(
  "/:id/services/:serviceId",
  requireAuth,
  listingPriv,
  validate({ body: updateServiceSchema }),
  asyncHandler(updateServiceHandler),
);
businessesRouter.delete("/:id/services/:serviceId", requireAuth, listingPriv, asyncHandler(deleteServiceHandler));
