import { Request, Response } from "express";
import { ok } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as sitesService from "./sites.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function getSiteHandler(req: Request, res: Response): Promise<void> {
  ok(res, await sitesService.getSiteForEditor(actor(req), req.params.id));
}

export async function saveSiteHandler(req: Request, res: Response): Promise<void> {
  ok(res, await sitesService.saveSite(actor(req), req.params.id, req.body));
}

export async function publishSiteHandler(req: Request, res: Response): Promise<void> {
  ok(res, await sitesService.setPublished(actor(req), req.params.id, req.body.isPublished));
}

// Public: rendered page for a published site.
export async function publicSiteHandler(req: Request, res: Response): Promise<void> {
  const site = await sitesService.getPublishedSite(req.params.slug);
  if (!site) throw AppError.notFound("This business has not published a website yet");
  ok(res, site);
}
