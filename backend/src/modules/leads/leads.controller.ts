import { Request, Response } from "express";
import { created, ok, paginated } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as leadsService from "./leads.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function createLeadHandler(req: Request, res: Response): Promise<void> {
  created(res, await leadsService.createLead(req.params.businessId, req.user?.sub, req.body));
}

export async function listLeadsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await leadsService.listLeadsForBusiness(actor(req).sub, req.params.businessId, req.query as any);
  paginated(res, items, meta);
}

export async function updateLeadStatusHandler(req: Request, res: Response): Promise<void> {
  ok(res, await leadsService.updateLeadStatus(actor(req).sub, req.params.leadId, req.body.status));
}
