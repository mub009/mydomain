import { Request, Response } from "express";
import { created, noContent, ok, paginated } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as businessesService from "./businesses.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function createBusinessHandler(req: Request, res: Response): Promise<void> {
  created(res, await businessesService.createBusiness(actor(req).sub, req.body));
}

export async function listBusinessesHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await businessesService.listBusinesses(req.query as any);
  paginated(res, items, meta);
}

export async function listMyBusinessesHandler(req: Request, res: Response): Promise<void> {
  ok(res, await businessesService.listMyBusinesses(actor(req).sub));
}

export async function getBusinessHandler(req: Request, res: Response): Promise<void> {
  ok(res, await businessesService.getBusinessBySlug(req.params.slug));
}

export async function updateBusinessHandler(req: Request, res: Response): Promise<void> {
  ok(res, await businessesService.updateBusiness(actor(req), req.params.id, req.body));
}

export async function deleteBusinessHandler(req: Request, res: Response): Promise<void> {
  await businessesService.deleteBusiness(actor(req), req.params.id);
  noContent(res);
}

export async function submitForApprovalHandler(req: Request, res: Response): Promise<void> {
  ok(res, await businessesService.submitForApproval(actor(req), req.params.id));
}

export async function addPhotoHandler(req: Request, res: Response): Promise<void> {
  created(res, await businessesService.addPhoto(actor(req), req.params.id, req.body));
}

export async function removePhotoHandler(req: Request, res: Response): Promise<void> {
  await businessesService.removePhoto(actor(req), req.params.id, req.params.photoId);
  noContent(res);
}

export async function setHoursHandler(req: Request, res: Response): Promise<void> {
  ok(res, await businessesService.setHours(actor(req), req.params.id, req.body.hours));
}

export async function addServiceHandler(req: Request, res: Response): Promise<void> {
  created(res, await businessesService.addService(actor(req), req.params.id, req.body));
}

export async function updateServiceHandler(req: Request, res: Response): Promise<void> {
  ok(res, await businessesService.updateService(actor(req), req.params.id, req.params.serviceId, req.body));
}

export async function deleteServiceHandler(req: Request, res: Response): Promise<void> {
  await businessesService.deleteService(actor(req), req.params.id, req.params.serviceId);
  noContent(res);
}
