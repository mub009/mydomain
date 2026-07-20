import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";

async function recalculateRating(businessId: string): Promise<void> {
  const agg = await prisma.review.aggregate({
    where: { businessId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await prisma.business.update({
    where: { id: businessId },
    data: {
      avgRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
      reviewCount: agg._count.rating,
    },
  });
}

export async function createReview(
  userId: string,
  businessId: string,
  data: { rating: number; title?: string; comment?: string },
) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");

  const existing = await prisma.review.findUnique({ where: { businessId_userId: { businessId, userId } } });
  if (existing) throw AppError.conflict("You have already reviewed this business");

  const review = await prisma.review.create({ data: { businessId, userId, ...data } });
  await recalculateRating(businessId);
  return review;
}

export async function listReviewsForBusiness(businessId: string, query: { page?: number; pageSize?: number }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where: { businessId },
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    }),
    prisma.review.count({ where: { businessId } }),
  ]);
  return { items, meta: { page, pageSize, total } };
}

export async function replyToReview(ownerId: string, reviewId: string, ownerReply: string) {
  const review = await prisma.review.findUnique({ where: { id: reviewId }, include: { business: true } });
  if (!review) throw AppError.notFound("Review not found");
  if (review.business.ownerId !== ownerId) throw AppError.forbidden("You do not own this business");

  return prisma.review.update({ where: { id: reviewId }, data: { ownerReply, ownerRepliedAt: new Date() } });
}

export async function deleteReview(actor: { sub: string; role: string }, reviewId: string) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw AppError.notFound("Review not found");
  if (review.userId !== actor.sub && actor.role !== "ADMIN") throw AppError.forbidden();

  await prisma.review.delete({ where: { id: reviewId } });
  await recalculateRating(review.businessId);
}
