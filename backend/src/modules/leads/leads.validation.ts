import { z } from "zod";
import { LeadSource, LeadStatus } from "@prisma/client";

export const createLeadSchema = z.object({
  name: z.string().min(1).max(150),
  phone: z.string().min(7).max(20),
  email: z.string().email().optional(),
  message: z.string().max(1000).optional(),
  source: z.nativeEnum(LeadSource).default(LeadSource.SEARCH),
});

export const updateLeadStatusSchema = z.object({
  status: z.nativeEnum(LeadStatus),
});

export const listLeadsQuerySchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});
