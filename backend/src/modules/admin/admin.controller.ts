import { Request, Response } from "express";
import { created, ok, paginated } from "@/common/apiResponse";
import * as adminService from "./admin.service";

export async function listPendingBusinessesHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await adminService.listPendingBusinesses(req.query as any);
  paginated(res, items, meta);
}

// Users
export async function listUsersHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await adminService.listUsers(req.query as any);
  paginated(res, items, meta);
}

export async function createUserHandler(req: Request, res: Response): Promise<void> {
  created(res, await adminService.createUser(req.body, req.user?.sub));
}

export async function businessCreatorsReportHandler(_req: Request, res: Response): Promise<void> {
  ok(res, await adminService.getBusinessCreatorsReport());
}

export async function updateUserHandler(req: Request, res: Response): Promise<void> {
  ok(res, await adminService.updateUser(req.params.id, req.body));
}

// Businesses (admin-wide)
export async function listAllBusinessesHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await adminService.listAllBusinesses(req.query as any);
  paginated(res, items, meta);
}

export async function updateBusinessAsAdminHandler(req: Request, res: Response): Promise<void> {
  ok(res, await adminService.updateBusinessAsAdmin(req.params.id, req.body));
}

export async function reassignBusinessHandler(req: Request, res: Response): Promise<void> {
  ok(res, await adminService.reassignBusiness(req.params.id, req.body.ownerId));
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
