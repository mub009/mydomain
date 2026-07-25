import { Request, Response } from "express";
import { created } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as registrationsService from "./registrations.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function registerShopHandler(req: Request, res: Response): Promise<void> {
  created(res, await registrationsService.registerShop(actor(req).sub, req.body));
}

export async function listMyRegistrationsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta, summary } = await registrationsService.listMyRegistrations(actor(req).sub, req.query as any);
  res.status(200).json({ success: true, data: items, meta: { ...meta, totalPages: Math.ceil(meta.total / meta.pageSize) || 1 }, summary });
}

export async function listAllRegistrationsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta, summary } = await registrationsService.listAllRegistrations(req.query as any);
  res.status(200).json({ success: true, data: items, meta: { ...meta, totalPages: Math.ceil(meta.total / meta.pageSize) || 1 }, summary });
}
