import { Request, Response } from "express";
import { created, noContent, ok, paginated } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as postersService from "./posters.service";
import { readUploadedImage } from "./upload";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

// Admin -------------------------------------------------------------------
export async function studioOptionsHandler(_req: Request, res: Response): Promise<void> {
  ok(res, postersService.studioOptions());
}

export async function listDesignsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await postersService.listDesigns(req.query as never);
  paginated(res, items, meta);
}

export async function getDesignHandler(req: Request, res: Response): Promise<void> {
  ok(res, await postersService.getDesign(req.params.id));
}

export async function createDesignHandler(req: Request, res: Response): Promise<void> {
  created(res, await postersService.createDesign(actor(req), req.body));
}

export async function updateDesignHandler(req: Request, res: Response): Promise<void> {
  ok(res, await postersService.updateDesign(req.params.id, req.body));
}

export async function deleteDesignHandler(req: Request, res: Response): Promise<void> {
  await postersService.deleteDesign(req.params.id);
  noContent(res);
}

export async function previewHandler(req: Request, res: Response): Promise<void> {
  const { businessId, ...design } = req.body;
  ok(res, await postersService.previewDesign(design, businessId));
}

export async function previewBusinessesHandler(req: Request, res: Response): Promise<void> {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  ok(res, await postersService.previewBusinesses(search));
}

export async function aiSuggestHandler(req: Request, res: Response): Promise<void> {
  ok(res, await postersService.aiSuggest(req.body));
}

export async function aiBandsHandler(req: Request, res: Response): Promise<void> {
  ok(res, await postersService.aiBands(req.body));
}

/** Validates an uploaded design and hands back the data URI to save with it. */
export async function uploadArtworkHandler(req: Request, res: Response): Promise<void> {
  ok(res, readUploadedImage(req.file));
}

export async function designUsageHandler(req: Request, res: Response): Promise<void> {
  ok(res, await postersService.designUsage(req.params.id));
}

// Business ----------------------------------------------------------------
export async function businessPostersHandler(req: Request, res: Response): Promise<void> {
  ok(res, await postersService.listForBusiness(actor(req), req.params.id));
}

export async function renderPosterHandler(req: Request, res: Response): Promise<void> {
  ok(res, await postersService.renderForOwner(actor(req), req.params.id, req.params.designId));
}

export async function recordDownloadHandler(req: Request, res: Response): Promise<void> {
  ok(res, await postersService.recordDownload(actor(req), req.params.id, req.params.designId));
}
