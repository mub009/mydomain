import bcrypt from "bcryptjs";
import { BusinessStatus, UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";

interface Actor {
  sub: string;
  role: UserRole;
}

interface OwnerAccountInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}

function assertOwnerOrAdmin(actor: Actor, ownerId: string): void {
  if (actor.role === UserRole.ADMIN) return;
  if (actor.sub !== ownerId) throw AppError.forbidden("You do not own this business");
}

export async function createBusiness(actor: Actor, data: Record<string, unknown>) {
  const { owner, ...businessData } = data as { owner?: OwnerAccountInput } & Record<string, unknown>;

  const category = await prisma.category.findUnique({ where: { id: businessData.categoryId as string } });
  if (!category) throw AppError.badRequest("Invalid categoryId");

  // Plain owners always own their listings. Dealers and admins may instead
  // supply a login for the business's own team; the listing is then assigned
  // to that account so the business can sign in and manage it themselves.
  const canAssignOwner = actor.role === UserRole.DEALER || actor.role === UserRole.ADMIN;
  if (!owner || !canAssignOwner) {
    return prisma.business.create({
      data: {
        ...(businessData as any),
        ownerId: actor.sub,
        status: BusinessStatus.PENDING_APPROVAL,
      },
    });
  }

  const existing = await prisma.user.findUnique({ where: { email: owner.email } });
  if (existing && (existing.role === UserRole.ADMIN || existing.role === UserRole.DEALER)) {
    throw AppError.badRequest("This email belongs to a staff account and can't be used as a business login");
  }
  if (owner.phone && (!existing || existing.phone !== owner.phone)) {
    const phoneTaken = await prisma.user.findUnique({ where: { phone: owner.phone } });
    if (phoneTaken && phoneTaken.id !== existing?.id) {
      throw AppError.conflict("That phone number is already registered to another account");
    }
  }

  return prisma.$transaction(async (tx) => {
    let ownerRecord = existing;

    if (ownerRecord) {
      // Reuse the account; promote a plain customer to a business owner.
      if (ownerRecord.role === UserRole.CUSTOMER) {
        ownerRecord = await tx.user.update({ where: { id: ownerRecord.id }, data: { role: UserRole.BUSINESS_OWNER } });
      }
    } else {
      const passwordHash = await bcrypt.hash(owner.password, 12);
      ownerRecord = await tx.user.create({
        data: {
          email: owner.email,
          phone: owner.phone,
          passwordHash,
          firstName: owner.firstName,
          lastName: owner.lastName,
          role: UserRole.BUSINESS_OWNER,
          status: UserStatus.ACTIVE,
          // Remember who set this account up so the dealer can manage it
          // later (e.g. reset the password on the owner's behalf).
          createdById: actor.sub,
        },
      });
    }

    const business = await tx.business.create({
      data: {
        ...(businessData as any),
        ownerId: ownerRecord.id,
        status: BusinessStatus.PENDING_APPROVAL,
      },
    });

    // ownerAccount tells the client whether a fresh login was created (so it
    // can show the credentials) or an existing account was linked.
    return { ...business, ownerAccount: { email: ownerRecord.email, created: !existing } };
  });
}

export async function listBusinesses(query: { page?: number; pageSize?: number; categoryId?: string; city?: string; status?: string }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where: Record<string, unknown> = { status: BusinessStatus.PUBLISHED };
  if (query.categoryId) where.categoryId = query.categoryId;
  // MySQL's default collation is already case-insensitive, so a plain
  // equality filter behaves the same as Postgres's `mode: "insensitive"`.
  if (query.city) where.city = query.city;

  const [items, total] = await Promise.all([
    prisma.business.findMany({
      where,
      skip,
      take,
      orderBy: [{ avgRating: "desc" }, { reviewCount: "desc" }],
      include: { category: true, photos: { take: 1, orderBy: { sortOrder: "asc" } } },
    }),
    prisma.business.count({ where }),
  ]);

  return { items, meta: { page, pageSize, total } };
}

export async function listMyBusinesses(ownerId: string) {
  return prisma.business.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" }, include: { category: true } });
}

export async function getBusinessBySlug(slug: string) {
  const business = await prisma.business.findUnique({
    where: { slug },
    include: {
      category: true,
      photos: { orderBy: { sortOrder: "asc" } },
      hours: { orderBy: { dayOfWeek: "asc" } },
      services: { where: { isActive: true } },
      reviews: { orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
    },
  });
  if (!business) throw AppError.notFound("Business not found");

  prisma.business.update({ where: { id: business.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);

  return business;
}

export async function getBusinessById(id: string) {
  const business = await prisma.business.findUnique({ where: { id } });
  if (!business) throw AppError.notFound("Business not found");
  return business;
}

// Owner-scoped full fetch for the management dashboard: includes ALL
// services (not just active ones), every photo and hours row, and does not
// increment the public view counter.
export async function getBusinessForOwner(actor: Actor, id: string) {
  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      category: true,
      photos: { orderBy: { sortOrder: "asc" } },
      hours: { orderBy: { dayOfWeek: "asc" } },
      services: { orderBy: { createdAt: "asc" } },
      _count: { select: { leads: true, bookings: true, reviews: true } },
    },
  });
  if (!business) throw AppError.notFound("Business not found");
  assertOwnerOrAdmin(actor, business.ownerId);
  return business;
}

export async function updateBusiness(actor: Actor, id: string, data: Record<string, unknown>) {
  const business = await getBusinessById(id);
  assertOwnerOrAdmin(actor, business.ownerId);
  return prisma.business.update({ where: { id }, data: data as any });
}

export async function deleteBusiness(actor: Actor, id: string) {
  const business = await getBusinessById(id);
  assertOwnerOrAdmin(actor, business.ownerId);
  await prisma.business.delete({ where: { id } });
}

export async function submitForApproval(actor: Actor, id: string) {
  const business = await getBusinessById(id);
  assertOwnerOrAdmin(actor, business.ownerId);
  return prisma.business.update({ where: { id }, data: { status: BusinessStatus.PENDING_APPROVAL } });
}

export async function addPhoto(actor: Actor, businessId: string, data: { url: string; caption?: string; sortOrder?: number }) {
  const business = await getBusinessById(businessId);
  assertOwnerOrAdmin(actor, business.ownerId);
  return prisma.businessPhoto.create({ data: { businessId, ...data } });
}

export async function removePhoto(actor: Actor, businessId: string, photoId: string) {
  const business = await getBusinessById(businessId);
  assertOwnerOrAdmin(actor, business.ownerId);
  await prisma.businessPhoto.delete({ where: { id: photoId } });
}

export async function setHours(actor: Actor, businessId: string, hours: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>) {
  const business = await getBusinessById(businessId);
  assertOwnerOrAdmin(actor, business.ownerId);

  await prisma.$transaction([
    prisma.businessHours.deleteMany({ where: { businessId } }),
    prisma.businessHours.createMany({ data: hours.map((h) => ({ ...h, businessId })) }),
  ]);

  return prisma.businessHours.findMany({ where: { businessId }, orderBy: { dayOfWeek: "asc" } });
}

export async function addService(actor: Actor, businessId: string, data: Record<string, unknown>) {
  const business = await getBusinessById(businessId);
  assertOwnerOrAdmin(actor, business.ownerId);
  return prisma.service.create({ data: { ...(data as any), businessId } });
}

export async function updateService(actor: Actor, businessId: string, serviceId: string, data: Record<string, unknown>) {
  const business = await getBusinessById(businessId);
  assertOwnerOrAdmin(actor, business.ownerId);
  return prisma.service.update({ where: { id: serviceId }, data: data as any });
}

export async function deleteService(actor: Actor, businessId: string, serviceId: string) {
  const business = await getBusinessById(businessId);
  assertOwnerOrAdmin(actor, business.ownerId);
  await prisma.service.delete({ where: { id: serviceId } });
}
