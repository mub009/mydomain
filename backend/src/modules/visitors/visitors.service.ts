import { Prisma } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";

interface CaptureInput {
  phone: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  userAgent?: string;
}

// Record (or refresh) a visitor who shared their number in the welcome popup.
// Re-visits update the last-seen timestamp and bump the visit counter rather
// than creating duplicates, so the popup only needs to ask once.
export async function captureVisitor(input: CaptureInput) {
  const hasLocation = input.latitude !== undefined && input.longitude !== undefined;
  const now = new Date();

  const visitor = await prisma.visitor.upsert({
    where: { phone: input.phone },
    create: {
      phone: input.phone,
      latitude: input.latitude,
      longitude: input.longitude,
      city: input.city,
      userAgent: input.userAgent,
      consentAt: now,
      locationAt: hasLocation ? now : undefined,
      lastSeenAt: now,
    },
    update: {
      // Only overwrite location when fresh coordinates were provided.
      ...(hasLocation ? { latitude: input.latitude, longitude: input.longitude, locationAt: now } : {}),
      ...(input.city ? { city: input.city } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
      lastSeenAt: now,
      visitCount: { increment: 1 },
    },
  });

  return { id: visitor.id, phone: visitor.phone };
}

// Attach coordinates to an already-captured visitor. The browser prompts for
// permission separately, so this often arrives after the number.
export async function updateVisitorLocation(id: string, latitude: number, longitude: number, city?: string) {
  const visitor = await prisma.visitor.findUnique({ where: { id } });
  if (!visitor) throw AppError.notFound("Visitor not found");

  await prisma.visitor.update({
    where: { id },
    data: { latitude, longitude, city, locationAt: new Date() },
  });
  return { id, located: true };
}

export async function listVisitors(query: { page?: number; pageSize?: number; search?: string; withLocation?: string }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where: Prisma.VisitorWhereInput = {};
  if (query.search) {
    where.OR = [{ phone: { contains: query.search } }, { city: { contains: query.search } }];
  }
  if (query.withLocation === "true") where.latitude = { not: null };

  const [items, total, located] = await Promise.all([
    prisma.visitor.findMany({ where, skip, take, orderBy: { lastSeenAt: "desc" } }),
    prisma.visitor.count({ where }),
    prisma.visitor.count({ where: { latitude: { not: null } } }),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayCount = await prisma.visitor.count({ where: { createdAt: { gte: startOfToday } } });

  return { items, meta: { page, pageSize, total }, summary: { located, todayCount } };
}
