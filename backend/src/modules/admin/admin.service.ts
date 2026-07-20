import { BusinessStatus } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";

export async function listPendingBusinesses(query: { page?: number; pageSize?: number }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where = { status: BusinessStatus.PENDING_APPROVAL };
  const [items, total] = await Promise.all([
    prisma.business.findMany({ where, skip, take, orderBy: { createdAt: "asc" }, include: { category: true, owner: { select: { email: true, firstName: true, lastName: true } } } }),
    prisma.business.count({ where }),
  ]);
  return { items, meta: { page, pageSize, total } };
}

export async function approveBusiness(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");
  return prisma.business.update({ where: { id: businessId }, data: { status: BusinessStatus.PUBLISHED, isVerified: true } });
}

export async function rejectBusiness(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");
  return prisma.business.update({ where: { id: businessId }, data: { status: BusinessStatus.DRAFT } });
}

export async function suspendBusiness(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");
  return prisma.business.update({ where: { id: businessId }, data: { status: BusinessStatus.SUSPENDED } });
}

export async function getPlatformStats() {
  const [userCount, businessCount, publishedBusinessCount, reviewCount, leadCount, bookingCount, openRfqCount] = await Promise.all([
    prisma.user.count(),
    prisma.business.count(),
    prisma.business.count({ where: { status: BusinessStatus.PUBLISHED } }),
    prisma.review.count(),
    prisma.lead.count(),
    prisma.booking.count(),
    prisma.rfq.count({ where: { status: "OPEN" } }),
  ]);

  return { userCount, businessCount, publishedBusinessCount, reviewCount, leadCount, bookingCount, openRfqCount };
}
