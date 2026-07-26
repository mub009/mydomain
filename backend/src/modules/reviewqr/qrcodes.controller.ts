import { Request, Response } from "express";
import { created, ok } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import { env } from "@/config/env";
import * as qrcodesService from "./qrcodes.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

// Admin -----------------------------------------------------------------
export async function generateBatchHandler(req: Request, res: Response): Promise<void> {
  created(res, await qrcodesService.generateBatch(req.body.count, req.body.batchLabel, req.body.channel));
}

export async function listQrCodesHandler(req: Request, res: Response): Promise<void> {
  const { items, meta, summary } = await qrcodesService.listQrCodes(req.query as any);
  res.status(200).json({
    success: true,
    data: items,
    meta: { ...meta, totalPages: Math.ceil(meta.total / meta.pageSize) || 1 },
    summary,
  });
}

export async function updateQrCodeHandler(req: Request, res: Response): Promise<void> {
  ok(res, await qrcodesService.updateQrCodeAsAdmin(req.params.id, req.body));
}

// Shop-facing -----------------------------------------------------------
export async function lookupCodeHandler(req: Request, res: Response): Promise<void> {
  ok(res, await qrcodesService.lookupCode(req.params.code));
}

export async function claimCodeHandler(req: Request, res: Response): Promise<void> {
  ok(res, await qrcodesService.claimCode(actor(req), req.body.code, req.body.businessId, req.body.channel));
}

export async function setBoardChannelHandler(req: Request, res: Response): Promise<void> {
  ok(res, await qrcodesService.setBoardChannel(actor(req), req.params.qrId, req.body.channel));
}

export async function businessQrCodesHandler(req: Request, res: Response): Promise<void> {
  ok(res, await qrcodesService.listBusinessQrCodes(actor(req), req.params.id));
}

// Public scan -----------------------------------------------------------
// The printed board encodes this URL. A claimed board redirects the customer
// to the review page; an unclaimed one sends the shop to the confirm screen.
export async function qrScanHandler(req: Request, res: Response): Promise<void> {
  const result = await qrcodesService.resolveQrScan(req.params.code, req.get("user-agent") ?? undefined);

  if (result.kind === "redirect") {
    res.redirect(302, result.url);
    return;
  }
  if (result.kind === "claim") {
    res.redirect(302, `${env.CLIENT_ORIGIN}/qr/${result.code}`);
    return;
  }
  if (result.kind === "listing") {
    res.redirect(302, `${env.CLIENT_ORIGIN}/business/${result.slug}`);
    return;
  }
  res.redirect(302, `${env.CLIENT_ORIGIN}/qr/${result.code}?unknown=1`);
}
