import { Request, Response } from "express";
import { ok } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as reviewqrService from "./reviewqr.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function getReviewLinksHandler(req: Request, res: Response): Promise<void> {
  ok(res, await reviewqrService.getReviewLinks(actor(req), req.params.id));
}

export async function updateReviewLinksHandler(req: Request, res: Response): Promise<void> {
  ok(res, await reviewqrService.updateReviewLinks(actor(req), req.params.id, req.body));
}
