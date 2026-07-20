import { Response } from "express";

export function ok<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data });
}

export function paginated<T>(
  res: Response,
  items: T[],
  meta: { page: number; pageSize: number; total: number },
): Response {
  return res.status(200).json({
    success: true,
    data: items,
    meta: { ...meta, totalPages: Math.ceil(meta.total / meta.pageSize) || 1 },
  });
}

export function created<T>(res: Response, data: T): Response {
  return ok(res, data, 201);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}
