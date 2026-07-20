import { BusinessStatus, UserRole } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";

interface Actor {
  sub: string;
  role: UserRole;
}

function assertOwnerOrAdmin(actor: Actor, ownerId: string): void {
  if (actor.role === UserRole.ADMIN) return;
  if (actor.sub !== ownerId) throw AppError.forbidden("You do not own this business");
}

export async function createBusiness(ownerId: string, data: Record<string, unknown>) {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId as string } });
  if (!category) throw AppError.badRequest("Invalid categoryId");

  return prisma.business.create({
    data: {
      ...(data as any),
      ownerId,
      status: BusinessStatus.PENDING_APPROVAL,
    },
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
