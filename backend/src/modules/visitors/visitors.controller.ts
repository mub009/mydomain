import { Request, Response } from "express";
import { created, ok } from "@/common/apiResponse";
import * as visitorsService from "./visitors.service";

// Normalise to the bare 10-digit number so "+919876543210" and "9876543210"
// are the same visitor.
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

export async function captureVisitorHandler(req: Request, res: Response): Promise<void> {
  created(
    res,
    await visitorsService.captureVisitor({
      phone: normalizePhone(req.body.phone),
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      city: req.body.city,
      userAgent: req.get("user-agent") ?? undefined,
    }),
  );
}

export async function updateLocationHandler(req: Request, res: Response): Promise<void> {
  ok(
    res,
    await visitorsService.updateVisitorLocation(req.params.id, req.body.latitude, req.body.longitude, req.body.city),
  );
}

export async function listVisitorsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta, summary } = await visitorsService.listVisitors(req.query as any);
  res.status(200).json({
    success: true,
    data: items,
    meta: { ...meta, totalPages: Math.ceil(meta.total / meta.pageSize) || 1 },
    summary,
  });
}
