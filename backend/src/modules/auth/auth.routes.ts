import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { authRateLimit } from "@/middleware/rateLimit";
import { loginSchema, refreshSchema, registerSchema } from "./auth.validation";
import { loginHandler, logoutHandler, meHandler, refreshHandler, registerHandler } from "./auth.controller";

export const authRouter = Router();

authRouter.post("/register", authRateLimit, validate({ body: registerSchema }), asyncHandler(registerHandler));
authRouter.post("/login", authRateLimit, validate({ body: loginSchema }), asyncHandler(loginHandler));
authRouter.post("/refresh", validate({ body: refreshSchema }), asyncHandler(refreshHandler));
authRouter.post("/logout", validate({ body: refreshSchema }), asyncHandler(logoutHandler));
authRouter.get("/me", requireAuth, asyncHandler(meHandler));
