import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth, requirePrivilege } from "@/middleware/auth";
import { publishSiteSchema, saveSiteSchema } from "./sites.validation";
import { getSiteHandler, publicSiteHandler, publishSiteHandler, saveSiteHandler } from "./sites.controller";

// Owner-facing builder, nested under the business it belongs to.
export const siteBuilderRouter = Router();

const listingPriv = requirePrivilege("MANAGE_LISTINGS");

siteBuilderRouter.get("/:id/site", requireAuth, asyncHandler(getSiteHandler));
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
