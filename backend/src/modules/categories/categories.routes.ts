import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth, requireRole } from "@/middleware/auth";
import { createCategorySchema, updateCategorySchema } from "./categories.validation";
import {
  createCategoryHandler,
  deleteCategoryHandler,
  getCategoryHandler,
  listCategoriesHandler,
  updateCategoryHandler,
} from "./categories.controller";

export const categoriesRouter = Router();

categoriesRouter.get("/", asyncHandler(listCategoriesHandler));
categoriesRouter.get("/:slug", asyncHandler(getCategoryHandler));
categoriesRouter.post(
  "/",
  requireAuth,
  requireRole(UserRole.ADMIN),
  validate({ body: createCategorySchema }),
  asyncHandler(createCategoryHandler),
);
categoriesRouter.patch(
  "/:id",
  requireAuth,
  requireRole(UserRole.ADMIN),
  validate({ body: updateCategorySchema }),
  asyncHandler(updateCategoryHandler),
);
categoriesRouter.delete("/:id", requireAuth, requireRole(UserRole.ADMIN), asyncHandler(deleteCategoryHandler));
