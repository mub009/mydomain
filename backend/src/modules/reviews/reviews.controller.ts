import { Request, Response } from "express";
import { created, noContent, ok, paginated } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as reviewsService from "./reviews.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function createReviewHandler(req: Request, res: Response): Promise<void> {
  created(res, await reviewsService.createReview(actor(req).sub, req.params.businessId, req.body));
}

export async function listReviewsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await reviewsService.listReviewsForBusiness(req.params.businessId, req.query as any);
  paginated(res, items, meta);
}

export async function replyToReviewHandler(req: Request, res: Response): Promise<void> {
  ok(res, await reviewsService.replyToReview(actor(req).sub, req.params.reviewId, req.body.ownerReply));
}

export async function deleteReviewHandler(req: Request, res: Response): Promise<void> {
  await reviewsService.deleteReview(actor(req), req.params.reviewId);
  noContent(res);
}
