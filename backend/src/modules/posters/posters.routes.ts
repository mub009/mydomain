import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import {
  aiBriefSchema,
  bandBriefSchema,
  createDesignSchema,
  designerSchema,
  listDesignsQuerySchema,
  previewBusinessQuerySchema,
  previewSchema,
  updateDesignSchema,
} from "./posters.validation";
import {
  aiBandsHandler,
  aiSuggestHandler,
  businessPostersHandler,
  createDesignHandler,
  createDesignerHandler,
  deleteDesignHandler,
  designUsageHandler,
  getDesignHandler,
  listDesignersHandler,
  listDesignsHandler,
  previewBusinessesHandler,
  previewHandler,
  recordDownloadHandler,
  renderPosterHandler,
  studioOptionsHandler,
  updateDesignHandler,
  uploadArtworkHandler,
} from "./posters.controller";
import { MAX_ARTWORK_BYTES } from "./upload";

// Held in memory and returned as a data URI — nothing is written to disk, and
// the real check is on the bytes (see `readUploadedImage`), not this filter.
const artwork = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ARTWORK_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

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
adminPostersRouter.post("/posters/ai-bands", validate({ body: bandBriefSchema }), asyncHandler(aiBandsHandler));
adminPostersRouter.post("/posters/artwork", artwork.single("file"), asyncHandler(uploadArtworkHandler));

// Designers — the "select or enter" list on the poster form.
adminPostersRouter.get("/posters/designers", asyncHandler(listDesignersHandler));
adminPostersRouter.post("/posters/designers", validate({ body: designerSchema }), asyncHandler(createDesignerHandler));

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
