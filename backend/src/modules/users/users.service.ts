import bcrypt from "bcryptjs";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";

interface Actor {
  sub: string;
  role: UserRole;
}

// Reset a user's password on their behalf.
// - Admins may reset anyone's password.
// - Dealers may only reset accounts they created themselves (the business
//   logins they hand out), never staff accounts.
// All of the target's refresh tokens are revoked so old sessions sign out.
export async function resetUserPassword(actor: Actor, targetId: string, newPassword: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw AppError.notFound("User not found");

  if (actor.role === UserRole.DEALER) {
    const isStaff = target.role === UserRole.ADMIN || target.role === UserRole.DEALER;
    if (isStaff || target.createdById !== actor.sub) {
      throw AppError.forbidden("You can only reset passwords for accounts you created");
    }
  } else if (actor.role !== UserRole.ADMIN) {
    throw AppError.forbidden();
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: targetId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId: targetId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  return { id: target.id, email: target.email, firstName: target.firstName, lastName: target.lastName };
}

// The accounts this staff member created (a dealer's handed-out business
// logins), so they can be listed and managed from the dashboard.
export async function listCreatedUsers(creatorId: string, query: { page?: number; pageSize?: number; search?: string }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where: Prisma.UserWhereInput = { createdById: creatorId };
  if (query.search) {
    where.OR = [
      { email: { contains: query.search } },
      { firstName: { contains: query.search } },
      { lastName: { contains: query.search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        _count: { select: { businesses: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, meta: { page, pageSize, total } };
}
