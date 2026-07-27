import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth, requirePrivilege } from "@/middleware/auth";
import {
  campaignStatusSchema,
  createCampaignSchema,
  createContactSchema,
  importQuerySchema,
  listContactsQuerySchema,
  sendingSettingsSchema,
  testMessageSchema,
  listQuerySchema,
  templateSchema,
  updateContactSchema,
  updateTemplateSchema,
} from "./whatsapp.validation";
import {
  connectHandler,
  createCampaignHandler,
  createContactHandler,
  createTemplateHandler,
  deleteContactHandler,
  deleteTemplateHandler,
  disconnectHandler,
  getCampaignHandler,
  importContactsHandler,
  listCampaignsHandler,
  listContactsHandler,
  listTemplatesHandler,
  retryFailedHandler,
  sessionHandler,
  testMessageHandler,
  updateSettingsHandler,
  setCampaignStatusHandler,
  startCampaignHandler,
  updateContactHandler,
  updateTemplateHandler,
} from "./whatsapp.controller";

// Spreadsheets are parsed in memory and never written to disk. The size cap
// is what a few tens of thousands of contact rows come to.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const isExcel =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.originalname.toLowerCase().endsWith(".xlsx");
    cb(null, isExcel);
  },
});

export const whatsappRouter = Router();

const listingPriv = requirePrivilege("MANAGE_LISTINGS");

// Session
whatsappRouter.get("/:id/whatsapp/session", requireAuth, asyncHandler(sessionHandler));
whatsappRouter.post("/:id/whatsapp/connect", requireAuth, listingPriv, asyncHandler(connectHandler));
whatsappRouter.post("/:id/whatsapp/disconnect", requireAuth, listingPriv, asyncHandler(disconnectHandler));
whatsappRouter.patch(
  "/:id/whatsapp/settings",
  requireAuth,
  listingPriv,
  validate({ body: sendingSettingsSchema }),
  asyncHandler(updateSettingsHandler),
);
// One message to a number of your choosing, to check wording before a blast.
whatsappRouter.post(
  "/:id/whatsapp/test",
  requireAuth,
  listingPriv,
  validate({ body: testMessageSchema }),
  asyncHandler(testMessageHandler),
);

// Contacts
whatsappRouter.get(
  "/:id/contacts",
  requireAuth,
  validate({ query: listContactsQuerySchema }),
  asyncHandler(listContactsHandler),
);
whatsappRouter.post(
  "/:id/contacts",
  requireAuth,
  listingPriv,
  validate({ body: createContactSchema }),
  asyncHandler(createContactHandler),
);
whatsappRouter.post(
  "/:id/contacts/import",
  requireAuth,
  listingPriv,
  upload.single("file"),
  validate({ query: importQuerySchema }),
  asyncHandler(importContactsHandler),
);
whatsappRouter.patch(
  "/:id/contacts/:contactId",
  requireAuth,
  listingPriv,
  validate({ body: updateContactSchema }),
  asyncHandler(updateContactHandler),
);
whatsappRouter.delete("/:id/contacts/:contactId", requireAuth, listingPriv, asyncHandler(deleteContactHandler));

// Templates
whatsappRouter.get("/:id/templates", requireAuth, asyncHandler(listTemplatesHandler));
whatsappRouter.post(
  "/:id/templates",
  requireAuth,
  listingPriv,
  validate({ body: templateSchema }),
  asyncHandler(createTemplateHandler),
);
whatsappRouter.patch(
  "/:id/templates/:templateId",
  requireAuth,
  listingPriv,
  validate({ body: updateTemplateSchema }),
  asyncHandler(updateTemplateHandler),
);
whatsappRouter.delete("/:id/templates/:templateId", requireAuth, listingPriv, asyncHandler(deleteTemplateHandler));

// Campaigns
whatsappRouter.get(
  "/:id/campaigns",
  requireAuth,
  validate({ query: listQuerySchema }),
  asyncHandler(listCampaignsHandler),
);
whatsappRouter.post(
  "/:id/campaigns",
  requireAuth,
  listingPriv,
  validate({ body: createCampaignSchema }),
  asyncHandler(createCampaignHandler),
);
whatsappRouter.get(
  "/:id/campaigns/:campaignId",
  requireAuth,
  validate({ query: listQuerySchema }),
  asyncHandler(getCampaignHandler),
);
whatsappRouter.post("/:id/campaigns/:campaignId/start", requireAuth, listingPriv, asyncHandler(startCampaignHandler));
whatsappRouter.post(
  "/:id/campaigns/:campaignId/retry",
  requireAuth,
  listingPriv,
  asyncHandler(retryFailedHandler),
);
whatsappRouter.patch(
  "/:id/campaigns/:campaignId/status",
  requireAuth,
  listingPriv,
  validate({ body: campaignStatusSchema }),
  asyncHandler(setCampaignStatusHandler),
);
