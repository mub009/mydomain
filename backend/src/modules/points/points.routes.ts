import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth, requireRole } from "@/middleware/auth";
import { listTransactionsQuerySchema } from "./points.validation";
import { myPointsHandler, myTransactionsHandler } from "./points.controller";

export const pointsRouter = Router();

// A dealer's own balance and ledger.
pointsRouter.get("/mine", requireAuth, requireRole(UserRole.DEALER, UserRole.ADMIN), asyncHandler(myPointsHandler));
pointsRouter.get(
  "/mine/transactions",
  requireAuth,
  requireRole(UserRole.DEALER, UserRole.ADMIN),
  validate({ query: listTransactionsQuerySchema }),
  asyncHandler(myTransactionsHandler),
);
