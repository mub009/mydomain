import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import {
  aiBriefSchema,
  createDesignSchema,
  listDesignsQuerySchema,
  previewBusinessQuerySchema,
  previewSchema,
  updateDesignSchema,
} from "./posters.validation";
import {
  aiSuggestHandler,
  businessPostersHandler,
  createDesignHandler,
  deleteDesignHandler,
  designUsageHandler,
  getDesignHandler,
  listDesignsHandler,
  previewBusinessesHandler,
  previewHandler,
  recordDownloadHandler,
  renderPosterHandler,
  studioOptionsHandler,
  updateDesignHandler,
} from "./posters.controller";

/** Admin Poster Studio. Mounted under /admin, which already requires ADMIN. */
export const adminPostersRouter = Router();

adminPostersRouter.get("/posters/options", asyncHandler(studioOptionsHandler));
adminPostersRouter.get(
  "/posters/preview-businesses",
  validate({ query: previewBusinessQuerySchema }),
  asyncHandler(previewBusinessesHandler),
);
adminPostersRouter.post("/posters/preview", validate({ body: previewSchema }), asyncHandler(previewHandler));
adminPostersRouter.post("/posters/ai-suggest", validate({ body: aiBriefSchema }), asyncHandler(aiSuggestHandler));

adminPostersRouter.get("/posters", validate({ query: listDesignsQuerySchema }), asyncHandler(listDesignsHandler));
adminPostersRouter.post("/posters", validate({ body: createDesignSchema }), asyncHandler(createDesignHandler));
adminPostersRouter.get("/posters/:id", asyncHandler(getDesignHandler));
adminPostersRouter.get("/posters/:id/usage", asyncHandler(designUsageHandler));
adminPostersRouter.patch("/posters/:id", validate({ body: updateDesignSchema }), asyncHandler(updateDesignHandler));
adminPostersRouter.delete("/posters/:id", asyncHandler(deleteDesignHandler));

/** What a shop sees in its own dashboard. */
export const businessPostersRouter = Router();

businessPostersRouter.get("/:id/posters", requireAuth, asyncHandler(businessPostersHandler));
businessPostersRouter.get("/:id/posters/:designId", requireAuth, asyncHandler(renderPosterHandler));
businessPostersRouter.post("/:id/posters/:designId/downloaded", requireAuth, asyncHandler(recordDownloadHandler));
