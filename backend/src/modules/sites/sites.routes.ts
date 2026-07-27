import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth, requirePrivilege } from "@/middleware/auth";
import { publishSiteSchema, saveSiteSchema } from "./sites.validation";
import {
  getSiteHandler,
  previewTemplateHandler,
  publicSiteHandler,
  publishSiteHandler,
  saveSiteHandler,
} from "./sites.controller";

// Owner-facing builder, nested under the business it belongs to.
export const siteBuilderRouter = Router();

const listingPriv = requirePrivilege("MANAGE_LISTINGS");

siteBuilderRouter.get("/:id/site", requireAuth, asyncHandler(getSiteHandler));
// Renders a design for this business without saving it — used by the picker.
siteBuilderRouter.get("/:id/site/templates/:templateId", requireAuth, asyncHandler(previewTemplateHandler));
siteBuilderRouter.put(
  "/:id/site",
  requireAuth,
  listingPriv,
  validate({ body: saveSiteSchema }),
  asyncHandler(saveSiteHandler),
);
siteBuilderRouter.post(
  "/:id/site/publish",
  requireAuth,
  listingPriv,
  validate({ body: publishSiteSchema }),
  asyncHandler(publishSiteHandler),
);

// Public: the published page, fetched by slug.
export const publicSiteRouter = Router();
publicSiteRouter.get("/:slug", asyncHandler(publicSiteHandler));
