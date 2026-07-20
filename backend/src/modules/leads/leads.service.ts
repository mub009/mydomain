import { LeadSource, LeadStatus } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";

export async function createLead(
  businessId: string,
  customerId: string | undefined,
  data: { name: string; phone: string; email?: string; message?: string; source: LeadSource },
) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");

  const [lead] = await prisma.$transaction([
    prisma.lead.create({ data: { businessId, customerId, ...data } }),
    prisma.business.update({ where: { id: businessId }, data: { leadCount: { increment: 1 } } }),
  ]);

  return lead;
}

export async function listLeadsForBusiness(
  ownerId: string,
  businessId: string,
  query: { status?: LeadStatus; page?: number; pageSize?: number },
) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");
  if (business.ownerId !== ownerId) throw AppError.forbidden("You do not own this business");

  const { page, pageSize, skip, take } = parsePagination(query);
  const where = { businessId, ...(query.status ? { status: query.status } : {}) };

  const [items, total] = await Promise.all([
    prisma.lead.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    prisma.lead.count({ where }),
  ]);

  return { items, meta: { page, pageSize, total } };
}

export async function updateLeadStatus(ownerId: string, leadId: string, status: LeadStatus) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { business: true } });
  if (!lead) throw AppError.notFound("Lead not found");
  if (lead.business.ownerId !== ownerId) throw AppError.forbidden("You do not own this business");

  return prisma.lead.update({ where: { id: leadId }, data: { status } });
}
