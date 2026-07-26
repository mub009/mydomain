import { Request, Response } from "express";
import { ReviewChannel } from "@prisma/client";
import { ok } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import { env } from "@/config/env";
import * as reviewqrService from "./reviewqr.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

const CHANNEL_BY_PARAM: Record<string, ReviewChannel> = {
  google: ReviewChannel.GOOGLE,
  instagram: ReviewChannel.INSTAGRAM,
  facebook: ReviewChannel.FACEBOOK,
};

export async function getReviewLinksHandler(req: Request, res: Response): Promise<void> {
  ok(res, await reviewqrService.getReviewLinks(actor(req), req.params.id));
}

export async function updateReviewLinksHandler(req: Request, res: Response): Promise<void> {
  ok(res, await reviewqrService.updateReviewLinks(actor(req), req.params.id, req.body));
}

export async function scanStatsHandler(req: Request, res: Response): Promise<void> {
  ok(res, await reviewqrService.getScanStats(actor(req), req.params.id));
}

// Public endpoint the QR code points at. Redirects the phone straight to the
// platform's review page; falls back to the listing when nothing is set up.
export async function scanRedirectHandler(req: Request, res: Response): Promise<void> {
  const requested = req.query.c ? CHANNEL_BY_PARAM[String(req.query.c)] : undefined;
  const resolved = await reviewqrService.resolveScan(req.params.slug, requested, req.get("user-agent") ?? undefined);

  if (!resolved) {
    // No external profile configured — send them to the public listing so the
    // scan still goes somewhere useful.
    res.redirect(302, `${env.CLIENT_ORIGIN}/business/${req.params.slug}`);
    return;
  }

  res.redirect(302, resolved.url);
}
