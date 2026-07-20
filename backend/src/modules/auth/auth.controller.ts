import { Request, Response } from "express";
import { created, ok } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as authService from "./auth.service";

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body);
  created(res, result);
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body);
  ok(res, result);
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const result = await authService.refresh(req.body.refreshToken);
  ok(res, result);
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  await authService.logout(req.body.refreshToken);
  ok(res, { message: "Logged out" });
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized();
  const profile = await authService.getProfile(req.user.sub);
  ok(res, profile);
}
