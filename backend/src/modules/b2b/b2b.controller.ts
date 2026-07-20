import { Request, Response } from "express";
import { created, ok, paginated } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as b2bService from "./b2b.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function createRfqHandler(req: Request, res: Response): Promise<void> {
  created(res, await b2bService.createRfq(actor(req).sub, req.body));
}

export async function listRfqsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await b2bService.listRfqs(req.query as any);
  paginated(res, items, meta);
}

export async function listMyRfqsHandler(req: Request, res: Response): Promise<void> {
  ok(res, await b2bService.listMyRfqs(actor(req).sub));
}

export async function getRfqHandler(req: Request, res: Response): Promise<void> {
  ok(res, await b2bService.getRfq(req.params.id));
}

export async function inviteSupplierHandler(req: Request, res: Response): Promise<void> {
  created(res, await b2bService.inviteSupplier(actor(req).sub, req.params.id, req.body.businessId));
}

export async function submitQuoteHandler(req: Request, res: Response): Promise<void> {
  created(res, await b2bService.submitQuote(actor(req).sub, req.params.id, req.body));
}

export async function awardQuoteHandler(req: Request, res: Response): Promise<void> {
  ok(res, await b2bService.awardQuote(actor(req).sub, req.params.id, req.params.quoteId));
}

export async function closeRfqHandler(req: Request, res: Response): Promise<void> {
  ok(res, await b2bService.closeRfq(actor(req).sub, req.params.id));
}
