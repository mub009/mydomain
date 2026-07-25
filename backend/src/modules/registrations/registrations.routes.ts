import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth, requirePrivilege, requireRole } from "@/middleware/auth";
import { listRegistrationsQuerySchema, registerShopSchema } from "./registrations.validation";
import {
  listAllRegistrationsHandler,
  listMyRegistrationsHandler,
  registerShopHandler,
} from "./registrations.controller";

export const registrationsRouter = Router();

const listingPriv = requirePrivilege("MANAGE_LISTINGS");

// A dealer registers a shop for an owner and records the collected fee.
registrationsRouter.post(
  "/",
  requireAuth,
  requireRole(UserRole.DEALER, UserRole.ADMIN),
  listingPriv,
  validate({ body: registerShopSchema }),
  asyncHandler(registerShopHandler),
);

// A dealer's own registrations + total collected.
registrationsRouter.get(
  "/mine",
  requireAuth,
  requireRole(UserRole.DEALER, UserRole.ADMIN),
  listingPriv,
  validate({ query: listRegistrationsQuerySchema }),
  asyncHandler(listMyRegistrationsHandler),
);

// Admin-wide oversight of every registration.
registrationsRouter.get(
  "/all",
  requireAuth,
  requireRole(UserRole.ADMIN),
  validate({ query: listRegistrationsQuerySchema }),
  asyncHandler(listAllRegistrationsHandler),
);
