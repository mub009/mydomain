import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth, requireRole } from "@/middleware/auth";
import { listCreatedUsersQuerySchema, resetPasswordSchema } from "./users.validation";
import { listCreatedUsersHandler, resetPasswordHandler } from "./users.controller";

export const usersRouter = Router();

// Accounts the caller created (a dealer's handed-out business logins).
usersRouter.get(
  "/created",
  requireAuth,
  requireRole(UserRole.DEALER, UserRole.ADMIN),
  validate({ query: listCreatedUsersQuerySchema }),
  asyncHandler(listCreatedUsersHandler),
);

// Reset a user's password. Admins: anyone; dealers: only accounts they created.
usersRouter.patch(
  "/:id/password",
  requireAuth,
  requireRole(UserRole.DEALER, UserRole.ADMIN),
  validate({ body: resetPasswordSchema }),
  asyncHandler(resetPasswordHandler),
);
