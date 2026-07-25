import bcrypt from "bcryptjs";
import { BusinessStatus, Prisma, UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";
import { DEFAULT_DEALER_PRIVILEGES, normalizePrivileges, Privilege } from "@/common/privileges";

const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  privileges: true,
  avatarUrl: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

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

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

export async function listUsers(query: { page?: number; pageSize?: number; role?: string; search?: string }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where: Prisma.UserWhereInput = {};
  if (query.role && query.role in UserRole) where.role = query.role as UserRole;
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
      select: { ...USER_PUBLIC_SELECT, _count: { select: { businesses: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, meta: { page, pageSize, total } };
}

export async function createUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  privileges?: Privilege[];
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw AppError.conflict("A user with this email already exists");

  // Only dealers carry a privilege list; default it if none was provided.
  const privileges =
    data.role === UserRole.DEALER ? normalizePrivileges(data.privileges ?? DEFAULT_DEALER_PRIVILEGES) : undefined;

  const passwordHash = await bcrypt.hash(data.password, 12);
  return prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role: data.role,
      status: UserStatus.ACTIVE,
      privileges: privileges ?? Prisma.DbNull,
    },
    select: USER_PUBLIC_SELECT,
  });
}

export async function updateUser(
  id: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: UserRole;
    status: UserStatus;
    privileges: Privilege[];
  }>,
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw AppError.notFound("User not found");

  // Guard against removing the last remaining admin.
  if (user.role === UserRole.ADMIN && data.role && data.role !== UserRole.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
    if (adminCount <= 1) throw AppError.badRequest("Cannot change the role of the last remaining admin");
  }

  const { privileges, ...rest } = data;
  const updateData: Prisma.UserUpdateInput = { ...rest };

  // Keep privileges consistent with the effective role: dealers get a
  // normalized list, everyone else has it cleared.
  const effectiveRole = data.role ?? user.role;
  if (effectiveRole === UserRole.DEALER) {
    if (privileges !== undefined) updateData.privileges = normalizePrivileges(privileges);
  } else {
    updateData.privileges = Prisma.DbNull;
  }

  return prisma.user.update({ where: { id }, data: updateData, select: USER_PUBLIC_SELECT });
}

// ---------------------------------------------------------------------------
// Business management (admin-wide)
// ---------------------------------------------------------------------------

export async function listAllBusinesses(query: { page?: number; pageSize?: number; status?: string; search?: string }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where: Prisma.BusinessWhereInput = {};
  if (query.status && query.status in BusinessStatus) where.status = query.status as BusinessStatus;
  if (query.search) {
    where.OR = [{ name: { contains: query.search } }, { city: { contains: query.search } }];
  }

  const [items, total] = await Promise.all([
    prisma.business.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        owner: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    }),
    prisma.business.count({ where }),
  ]);
  return { items, meta: { page, pageSize, total } };
}

export async function updateBusinessAsAdmin(businessId: string, data: Record<string, unknown>) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");

  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId as string } });
    if (!category) throw AppError.badRequest("Invalid categoryId");
  }

  return prisma.business.update({ where: { id: businessId }, data: data as Prisma.BusinessUpdateInput });
}

export async function reassignBusiness(businessId: string, newOwnerId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");

  const newOwner = await prisma.user.findUnique({ where: { id: newOwnerId } });
  if (!newOwner) throw AppError.notFound("Target user not found");
  if (newOwner.role !== UserRole.BUSINESS_OWNER && newOwner.role !== UserRole.DEALER && newOwner.role !== UserRole.ADMIN) {
    throw AppError.badRequest("New owner must be a business owner, dealer, or admin");
  }

  return prisma.business.update({
    where: { id: businessId },
    data: { ownerId: newOwnerId },
    include: { owner: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
  });
}

export async function getPlatformStats() {
  const [userCount, dealerCount, businessCount, publishedBusinessCount, pendingBusinessCount, reviewCount, leadCount, bookingCount, openRfqCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.DEALER } }),
      prisma.business.count(),
      prisma.business.count({ where: { status: BusinessStatus.PUBLISHED } }),
      prisma.business.count({ where: { status: BusinessStatus.PENDING_APPROVAL } }),
      prisma.review.count(),
      prisma.lead.count(),
      prisma.booking.count(),
      prisma.rfq.count({ where: { status: "OPEN" } }),
    ]);

  return {
    userCount,
    dealerCount,
    businessCount,
    publishedBusinessCount,
    pendingBusinessCount,
    reviewCount,
    leadCount,
    bookingCount,
    openRfqCount,
  };
}
