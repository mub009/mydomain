import { z } from "zod";
import { CampaignStatus } from "@prisma/client";

const page = {
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
};

export const listContactsQuerySchema = z.object({
  ...page,
  search: z.string().max(120).optional(),
  tag: z.string().max(60).optional(),
  optedOut: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const createContactSchema = z.object({
  name: z.string().min(1, "Please enter a name").max(120),
  phone: z.string().min(6, "Please enter a phone number").max(24),
  email: z.string().email("Please enter a valid email").max(160).optional(),
  tag: z.string().max(60).optional(),
});

export const updateContactSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  tag: z.string().max(60).nullable().optional(),
  optedOut: z.boolean().optional(),
});

export const importQuerySchema = z.object({
  // Applied to every row in the file, overriding any tag column.
  tag: z.string().max(60).optional(),
});

// WhatsApp's own limit for a text message is far higher, but a broadcast this
// long is a wall of text nobody reads.
export const templateSchema = z.object({
  name: z.string().min(1, "Give this template a name").max(120),
  body: z.string().min(1, "Write the message").max(4000),
});

export const updateTemplateSchema = templateSchema.partial();

export const createCampaignSchema = z.object({
  name: z.string().min(1, "Give this campaign a name").max(120),
  body: z.string().min(1, "Write the message").max(4000),
  templateId: z.string().uuid().optional(),
  tag: z.string().max(60).optional(),
  contactIds: z.array(z.string().uuid()).max(5000).optional(),
});

export const campaignStatusSchema = z.object({
  status: z.nativeEnum(CampaignStatus),
});

export const sendingSettingsSchema = z.object({
  dailyLimit: z.number().int().min(1).max(5000).optional(),
  // Floor of 2s: anything faster is a burst, which is what gets numbers
  // restricted. Ceiling of 10min keeps a campaign from looking stalled.
  sendDelayMs: z.number().int().min(2000).max(600_000).optional(),
  sendJitterMs: z.number().int().min(0).max(300_000).optional(),
  windowStartHour: z.number().int().min(0).max(23).optional(),
  windowEndHour: z.number().int().min(0).max(23).optional(),
  autoOptOut: z.boolean().optional(),
});

export const testMessageSchema = z.object({
  phone: z.string().min(6, "Enter the number to test with").max(24),
  body: z.string().min(1, "Write the message").max(4000),
});

export const listQuerySchema = z.object(page);
