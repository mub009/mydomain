import { QuoteStatus, RfqStatus } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";

export async function createRfq(buyerId: string, data: Record<string, unknown>) {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId as string } });
  if (!category) throw AppError.badRequest("Invalid categoryId");

  return prisma.rfq.create({ data: { ...(data as any), buyerId } });
}

export async function listRfqs(query: { categoryId?: string; city?: string; status?: string; page?: number; pageSize?: number }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where: Record<string, unknown> = {};
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.city) where.city = { equals: query.city, mode: "insensitive" };
  where.status = query.status ?? RfqStatus.OPEN;

  const [items, total] = await Promise.all([
    prisma.rfq.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { category: true, buyer: { select: { firstName: true, lastName: true } }, _count: { select: { quotes: true } } },
    }),
    prisma.rfq.count({ where }),
  ]);

  return { items, meta: { page, pageSize, total } };
}

export async function listMyRfqs(buyerId: string) {
  return prisma.rfq.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    include: { category: true, quotes: { include: { business: true } } },
  });
}

export async function getRfq(id: string) {
  const rfq = await prisma.rfq.findUnique({
    where: { id },
    include: {
      category: true,
      buyer: { select: { firstName: true, lastName: true } },
      quotes: { include: { business: { select: { id: true, name: true, slug: true, avgRating: true } } } },
      invites: true,
    },
  });
  if (!rfq) throw AppError.notFound("RFQ not found");
  return rfq;
}

export async function inviteSupplier(buyerId: string, rfqId: string, businessId: string) {
  const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!rfq) throw AppError.notFound("RFQ not found");
  if (rfq.buyerId !== buyerId) throw AppError.forbidden("You do not own this RFQ");

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");

  return prisma.rfqInvite.upsert({
    where: { rfqId_businessId: { rfqId, businessId } },
    create: { rfqId, businessId },
    update: {},
  });
}

export async function submitQuote(
  supplierId: string,
  rfqId: string,
  data: { businessId: string; priceCents: number; currency: string; message?: string; deliveryDays?: number },
) {
  const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!rfq) throw AppError.notFound("RFQ not found");
  if (rfq.status !== RfqStatus.OPEN && rfq.status !== RfqStatus.QUOTED) {
    throw AppError.badRequest("This RFQ is no longer accepting quotes");
  }

  const business = await prisma.business.findUnique({ where: { id: data.businessId } });
  if (!business) throw AppError.notFound("Business not found");
  if (business.ownerId !== supplierId) throw AppError.forbidden("You do not own this business");

  const quote = await prisma.quote.upsert({
    where: { rfqId_businessId: { rfqId, businessId: data.businessId } },
    create: { rfqId, supplierId, ...data },
    update: { priceCents: data.priceCents, currency: data.currency, message: data.message, deliveryDays: data.deliveryDays, status: QuoteStatus.SUBMITTED },
  });

  if (rfq.status === RfqStatus.OPEN) {
    await prisma.rfq.update({ where: { id: rfqId }, data: { status: RfqStatus.QUOTED } });
  }

  return quote;
}

export async function awardQuote(buyerId: string, rfqId: string, quoteId: string) {
  const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!rfq) throw AppError.notFound("RFQ not found");
  if (rfq.buyerId !== buyerId) throw AppError.forbidden("You do not own this RFQ");

  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote || quote.rfqId !== rfqId) throw AppError.notFound("Quote not found");

  await prisma.$transaction([
    prisma.quote.update({ where: { id: quoteId }, data: { status: QuoteStatus.ACCEPTED } }),
    prisma.quote.updateMany({
      where: { rfqId, id: { not: quoteId }, status: QuoteStatus.SUBMITTED },
      data: { status: QuoteStatus.REJECTED },
    }),
    prisma.rfq.update({ where: { id: rfqId }, data: { status: RfqStatus.AWARDED } }),
  ]);

  return prisma.rfq.findUnique({ where: { id: rfqId }, include: { quotes: true } });
}

export async function closeRfq(buyerId: string, rfqId: string) {
  const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!rfq) throw AppError.notFound("RFQ not found");
  if (rfq.buyerId !== buyerId) throw AppError.forbidden("You do not own this RFQ");

  return prisma.rfq.update({ where: { id: rfqId }, data: { status: RfqStatus.CLOSED } });
}
