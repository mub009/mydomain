import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "@/common/errors";
import { logger } from "@/config/logger";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: err.flatten() },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ success: false, error: { code: "CONFLICT", message: "A record with these unique fields already exists" } });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Related record not found" } });
      return;
    }
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
}
