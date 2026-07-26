import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { captureVisitorSchema, updateLocationSchema } from "./visitors.validation";
import { captureVisitorHandler, updateLocationHandler } from "./visitors.controller";

export const visitorsRouter = Router();

// Public: the welcome popup posts here once the visitor consents.
visitorsRouter.post("/", validate({ body: captureVisitorSchema }), asyncHandler(captureVisitorHandler));
visitorsRouter.patch("/:id/location", validate({ body: updateLocationSchema }), asyncHandler(updateLocationHandler));
