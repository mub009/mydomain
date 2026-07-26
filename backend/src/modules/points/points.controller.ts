import { Request, Response } from "express";
import { ok, paginated } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as pointsService from "./points.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function myPointsHandler(req: Request, res: Response): Promise<void> {
  ok(res, await pointsService.getMyPoints(actor(req).sub));
}

export async function myTransactionsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await pointsService.listTransactions(actor(req).sub, req.query as any);
  paginated(res, items, meta);
}

export async function adjustPointsHandler(req: Request, res: Response): Promise<void> {
  ok(res, await pointsService.adjustPoints(actor(req).sub, req.params.id, req.body.amount, req.body.note));
}

export async function userTransactionsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await pointsService.listTransactions(req.params.id, req.query as any);
  paginated(res, items, meta);
}
