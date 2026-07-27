import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "@/common/errors";
import { logger } from "@/config/logger";
import { findStaleClientGaps } from "@/config/prismaClientCheck";
import { env } from "@/config/env";

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
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: {
          ...err.flatten(),
          // Full field paths (e.g. "owner.phone") so clients can show which
          // field failed — flatten() collapses nested objects to one key.
          issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
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
    // The database is behind the code — a pending migration. Say so plainly:
    // this used to surface as an opaque "Something went wrong".
    if (err.code === "P2021" || err.code === "P2022") {
      logger.error({ err, path: req.path }, "Database schema is out of date");
      res.status(500).json({
        success: false,
        error: {
          code: "SCHEMA_OUT_OF_DATE",
          message:
            "The database is missing a recent update. Run `npm run prisma:deploy` then `npm run prisma:generate` in the backend and restart it.",
          details: env.NODE_ENV === "production" ? undefined : { prismaCode: err.code, hint: err.message },
        },
      });
      return;
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    logger.error({ err, path: req.path }, "Database unavailable");
    res.status(503).json({
      success: false,
      error: { code: "DATABASE_UNAVAILABLE", message: "Cannot reach the database. Check that MySQL is running." },
    });
    return;
  }

  // A generated client that predates the schema throws a plain TypeError the
  // moment the code touches a model or enum it does not know about. That used
  // to read as "Something went wrong"; name the real cause and the fix.
  const gaps = findStaleClientGaps();
  if (gaps.length > 0) {
    logger.error({ err, path: req.path, missing: gaps }, "Generated Prisma client is out of date");
    res.status(500).json({
      success: false,
      error: {
        code: "PRISMA_CLIENT_OUT_OF_DATE",
        message:
          "The backend's generated database client is out of date. Run `npm run prisma:generate` in the backend and restart it.",
        details: env.NODE_ENV === "production" ? undefined : { missing: gaps },
      },
    });
    return;
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong on the server. Check the backend logs for details.",
      // Surfaced outside production so a failing call is diagnosable from the UI.
      details:
        env.NODE_ENV === "production" ? undefined : { reason: err instanceof Error ? err.message : String(err) },
    },
  });
}
