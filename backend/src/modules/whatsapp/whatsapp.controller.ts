import { Request, Response } from "express";
import { created, ok, paginated } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as whatsapp from "./whatsapp.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

// --- Session ----------------------------------------------------------------

export async function sessionHandler(req: Request, res: Response): Promise<void> {
  ok(res, await whatsapp.getSession(actor(req), req.params.id));
}

export async function connectHandler(req: Request, res: Response): Promise<void> {
  ok(res, await whatsapp.connectSession(actor(req), req.params.id));
}

export async function updateSettingsHandler(req: Request, res: Response): Promise<void> {
  ok(res, await whatsapp.updateSendingSettings(actor(req), req.params.id, req.body));
}

export async function testMessageHandler(req: Request, res: Response): Promise<void> {
  ok(res, await whatsapp.sendTestMessage(actor(req), req.params.id, req.body.phone, req.body.body));
}

export async function retryFailedHandler(req: Request, res: Response): Promise<void> {
  ok(res, await whatsapp.retryFailedMessages(actor(req), req.params.campaignId));
}

export async function disconnectHandler(req: Request, res: Response): Promise<void> {
  ok(res, await whatsapp.disconnectSession(actor(req), req.params.id));
}

// --- Contacts ---------------------------------------------------------------

export async function listContactsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta, summary } = await whatsapp.listContacts(actor(req), req.params.id, req.query as never);
  res.status(200).json({
    success: true,
    data: items,
    meta: { ...meta, totalPages: Math.ceil(meta.total / meta.pageSize) || 1 },
    summary,
  });
}

export async function createContactHandler(req: Request, res: Response): Promise<void> {
  created(res, await whatsapp.createContact(actor(req), req.params.id, req.body));
}

export async function updateContactHandler(req: Request, res: Response): Promise<void> {
  ok(res, await whatsapp.updateContact(actor(req), req.params.contactId, req.body));
}

export async function deleteContactHandler(req: Request, res: Response): Promise<void> {
  ok(res, await whatsapp.deleteContact(actor(req), req.params.contactId));
}

export async function importContactsHandler(req: Request, res: Response): Promise<void> {
  const file = (req as Request & { file?: { buffer: Buffer } }).file;
  if (!file) throw AppError.badRequest("Attach an Excel file to upload");

  const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
  created(res, await whatsapp.importContacts(actor(req), req.params.id, file.buffer, tag));
}

// --- Templates --------------------------------------------------------------

export async function listTemplatesHandler(req: Request, res: Response): Promise<void> {
  ok(res, await whatsapp.listTemplates(actor(req), req.params.id));
}

export async function createTemplateHandler(req: Request, res: Response): Promise<void> {
  created(res, await whatsapp.createTemplate(actor(req), req.params.id, req.body));
}

export async function updateTemplateHandler(req: Request, res: Response): Promise<void> {
  ok(res, await whatsapp.updateTemplate(actor(req), req.params.templateId, req.body));
}

export async function deleteTemplateHandler(req: Request, res: Response): Promise<void> {
  ok(res, await whatsapp.deleteTemplate(actor(req), req.params.templateId));
}

// --- Campaigns --------------------------------------------------------------

export async function listCampaignsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await whatsapp.listCampaigns(actor(req), req.params.id, req.query as never);
  paginated(res, items, meta);
}

export async function createCampaignHandler(req: Request, res: Response): Promise<void> {
  created(res, await whatsapp.createCampaign(actor(req), req.params.id, req.body));
}

export async function getCampaignHandler(req: Request, res: Response): Promise<void> {
  const { campaign, messages, meta } = await whatsapp.getCampaign(
    actor(req),
    req.params.campaignId,
    req.query as never,
  );
  res.status(200).json({
    success: true,
    data: { campaign, messages },
    meta: { ...meta, totalPages: Math.ceil(meta.total / meta.pageSize) || 1 },
  });
}

export async function startCampaignHandler(req: Request, res: Response): Promise<void> {
  ok(res, await whatsapp.startCampaign(actor(req), req.params.campaignId));
}

export async function setCampaignStatusHandler(req: Request, res: Response): Promise<void> {
  ok(res, await whatsapp.setCampaignStatus(actor(req), req.params.campaignId, req.body.status));
}
