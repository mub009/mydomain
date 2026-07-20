import { Request, Response } from "express";
import { created, noContent, ok } from "@/common/apiResponse";
import * as categoriesService from "./categories.service";

export async function listCategoriesHandler(_req: Request, res: Response): Promise<void> {
  ok(res, await categoriesService.listCategories());
}

export async function getCategoryHandler(req: Request, res: Response): Promise<void> {
  ok(res, await categoriesService.getCategoryBySlug(req.params.slug));
}

export async function createCategoryHandler(req: Request, res: Response): Promise<void> {
  created(res, await categoriesService.createCategory(req.body));
}

export async function updateCategoryHandler(req: Request, res: Response): Promise<void> {
  ok(res, await categoriesService.updateCategory(req.params.id, req.body));
}

export async function deleteCategoryHandler(req: Request, res: Response): Promise<void> {
  await categoriesService.deleteCategory(req.params.id);
  noContent(res);
}
