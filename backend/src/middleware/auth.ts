import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "@/config/env";
import { AppError } from "@/common/errors";
import { prisma } from "@/config/database";
import { hasPrivilege, Privilege } from "@/common/privileges";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw AppError.unauthorized("Missing bearer token");
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    req.user = payload;
    next();
  } catch {
    throw AppError.unauthorized("Invalid or expired token");
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const token = header.slice("Bearer ".length);
      req.user = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.role)) throw AppError.forbidden("Insufficient permissions");
    next();
  };
}

// Gate a route on a dealer privilege. Non-dealer roles pass straight
// through (their access is governed by role + ownership checks); only
// DEALER accounts must hold the named privilege, which is read live from
// the database so admin changes take effect without re-login.
export function requirePrivilege(privilege: Privilege) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw AppError.unauthorized();
    if (req.user.role !== UserRole.DEALER) {
      next();
      return;
    }
    prisma.user
      .findUnique({ where: { id: req.user.sub }, select: { privileges: true } })
      .then((user) => {
        if (!hasPrivilege(UserRole.DEALER, user?.privileges, privilege)) {
          throw AppError.forbidden("Your account doesn't have permission for this action");
        }
        next();
      })
      .catch(next);
  };
}
