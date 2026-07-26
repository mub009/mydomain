import { Request, Response } from "express";
import { ok, paginated } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as usersService from "./users.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function resetPasswordHandler(req: Request, res: Response): Promise<void> {
  ok(res, await usersService.resetUserPassword(actor(req), req.params.id, req.body.password));
}

export async function listCreatedUsersHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await usersService.listCreatedUsers(actor(req).sub, req.query as any);
  paginated(res, items, meta);
}
