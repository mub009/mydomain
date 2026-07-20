import { Request, Response } from "express";
import { ok, paginated } from "@/common/apiResponse";
import * as adminService from "./admin.service";

export async function listPendingBusinessesHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await adminService.listPendingBusinesses(req.query as any);
  paginated(res, items, meta);
}

export async function approveBusinessHandler(req: Request, res: Response): Promise<void> {
  ok(res, await adminService.approveBusiness(req.params.id));
}

export async function rejectBusinessHandler(req: Request, res: Response): Promise<void> {
  ok(res, await adminService.rejectBusiness(req.params.id));
}

export async function suspendBusinessHandler(req: Request, res: Response): Promise<void> {
  ok(res, await adminService.suspendBusiness(req.params.id));
}

export async function platformStatsHandler(_req: Request, res: Response): Promise<void> {
  ok(res, await adminService.getPlatformStats());
}
