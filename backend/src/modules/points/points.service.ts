import { Prisma, PointTransactionType, UserRole } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";

// What registering one business costs a dealer.
export const POINTS_PER_BUSINESS = 1;

export const OUT_OF_POINTS_MESSAGE =
  "You have no points left to register a business. Please contact the admin to add more points to your account.";

const TRANSACTION_INCLUDE = {
  grantedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.PointTransactionInclude;

// Spend points for a business registration. Runs inside the caller's
// transaction so the listing and the debit commit together.
// Only dealers are charged — admins register listings for free.
export async function spendPointsForBusiness(
  tx: Prisma.TransactionClient,
  actor: { sub: string; role: UserRole },
  businessId: string,
): Promise<void> {
  if (actor.role !== UserRole.DEALER) return;

  const dealer = await tx.user.findUnique({ where: { id: actor.sub }, select: { points: true } });
  if (!dealer) throw AppError.notFound("User not found");
  if (dealer.points < POINTS_PER_BUSINESS) throw AppError.forbidden(OUT_OF_POINTS_MESSAGE);

  const updated = await tx.user.update({
    where: { id: actor.sub },
    data: { points: { decrement: POINTS_PER_BUSINESS } },
    select: { points: true },
  });

  await tx.pointTransaction.create({
    data: {
      userId: actor.sub,
      type: PointTransactionType.BUSINESS_CREATED,
      amount: -POINTS_PER_BUSINESS,
      balanceAfter: updated.points,
      businessId,
      note: "Business registration",
    },
  });
}

// Fail fast before doing any work, so we don't create an owner account and
// then reject the request for lack of points.
export async function assertHasPointsForBusiness(actor: { sub: string; role: UserRole }): Promise<void> {
  if (actor.role !== UserRole.DEALER) return;
  const dealer = await prisma.user.findUnique({ where: { id: actor.sub }, select: { points: true } });
  if (!dealer) throw AppError.notFound("User not found");
  if (dealer.points < POINTS_PER_BUSINESS) throw AppError.forbidden(OUT_OF_POINTS_MESSAGE);
}

// Admin adjusts a dealer's balance. A positive amount grants points, a
// negative amount removes them (never below zero).
export async function adjustPoints(
  adminId: string,
  targetId: string,
  amount: number,
  note?: string,
) {
  if (amount === 0) throw AppError.badRequest("Amount must not be zero");

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true, points: true } });
  if (!target) throw AppError.notFound("User not found");
  if (target.role !== UserRole.DEALER) throw AppError.badRequest("Points can only be assigned to dealer accounts");

  const balanceAfter = target.points + amount;
  if (balanceAfter < 0) {
    throw AppError.badRequest(`Cannot deduct ${Math.abs(amount)} points — the dealer only has ${target.points}`);
  }

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: targetId },
      data: { points: balanceAfter },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, points: true },
    }),
    prisma.pointTransaction.create({
      data: {
        userId: targetId,
        type: amount > 0 ? PointTransactionType.ADMIN_GRANT : PointTransactionType.ADMIN_DEDUCTION,
        amount,
        balanceAfter,
        note,
        grantedById: adminId,
      },
    }),
  ]);

  return user;
}

// A dealer's own balance plus how many businesses it can still register.
export async function getMyPoints(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { points: true, role: true } });
  if (!user) throw AppError.notFound("User not found");

  const spent = await prisma.pointTransaction.aggregate({
    where: { userId, type: PointTransactionType.BUSINESS_CREATED },
    _sum: { amount: true },
  });

  return {
    points: user.points,
    pointsPerBusiness: POINTS_PER_BUSINESS,
    businessesRemaining: Math.floor(user.points / POINTS_PER_BUSINESS),
    totalSpent: Math.abs(spent._sum.amount ?? 0),
    // Non-dealers are not charged, so their balance is informational only.
    chargeable: user.role === UserRole.DEALER,
  };
}

export async function listTransactions(userId: string, query: { page?: number; pageSize?: number }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where = { userId };
  const [items, total] = await Promise.all([
    prisma.pointTransaction.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: TRANSACTION_INCLUDE }),
    prisma.pointTransaction.count({ where }),
  ]);
  return { items, meta: { page, pageSize, total } };
}
