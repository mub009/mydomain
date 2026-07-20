import { BookingStatus } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export async function createBooking(
  customerId: string,
  businessId: string,
  data: { serviceId: string; scheduledAt: Date; notes?: string },
) {
  const service = await prisma.service.findUnique({ where: { id: data.serviceId } });
  if (!service || service.businessId !== businessId || !service.isActive) {
    throw AppError.badRequest("Service not available for this business");
  }

  if (data.scheduledAt.getTime() <= Date.now()) {
    throw AppError.badRequest("scheduledAt must be in the future");
  }

  const dayOfWeek = data.scheduledAt.getDay();
  const hours = await prisma.businessHours.findUnique({ where: { businessId_dayOfWeek: { businessId, dayOfWeek } } });
  if (hours) {
    if (hours.isClosed) throw AppError.badRequest("Business is closed on this day");
    const minutesOfDay = data.scheduledAt.getHours() * 60 + data.scheduledAt.getMinutes();
    if (minutesOfDay < timeToMinutes(hours.openTime) || minutesOfDay + service.durationMins > timeToMinutes(hours.closeTime)) {
      throw AppError.badRequest("Requested time is outside business hours");
    }
  }

  const windowStart = new Date(data.scheduledAt.getTime() - service.durationMins * 60_000);
  const windowEnd = new Date(data.scheduledAt.getTime() + service.durationMins * 60_000);
  const conflict = await prisma.booking.findFirst({
    where: {
      businessId,
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      scheduledAt: { gte: windowStart, lte: windowEnd },
    },
  });
  if (conflict) throw AppError.conflict("This time slot is already booked");

  return prisma.booking.create({
    data: {
      businessId,
      serviceId: service.id,
      customerId,
      scheduledAt: data.scheduledAt,
      notes: data.notes,
      priceCents: service.priceCents,
      currency: service.currency,
    },
  });
}

export async function listMyBookings(customerId: string, query: { page?: number; pageSize?: number }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const where = { customerId };
  const [items, total] = await Promise.all([
    prisma.booking.findMany({ where, skip, take, orderBy: { scheduledAt: "desc" }, include: { business: true, service: true } }),
    prisma.booking.count({ where }),
  ]);
  return { items, meta: { page, pageSize, total } };
}

export async function listBusinessBookings(ownerId: string, businessId: string, query: { page?: number; pageSize?: number }) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");
  if (business.ownerId !== ownerId) throw AppError.forbidden("You do not own this business");

  const { page, pageSize, skip, take } = parsePagination(query);
  const where = { businessId };
  const [items, total] = await Promise.all([
    prisma.booking.findMany({ where, skip, take, orderBy: { scheduledAt: "desc" }, include: { service: true, customer: { select: { firstName: true, lastName: true, phone: true } } } }),
    prisma.booking.count({ where }),
  ]);
  return { items, meta: { page, pageSize, total } };
}

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.NO_SHOW]: [],
};

export async function updateBookingStatus(actor: { sub: string; role: string }, bookingId: string, status: BookingStatus) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { business: true } });
  if (!booking) throw AppError.notFound("Booking not found");

  const isOwner = booking.business.ownerId === actor.sub;
  const isCustomer = booking.customerId === actor.sub;
  if (!isOwner && !isCustomer && actor.role !== "ADMIN") throw AppError.forbidden();
  if (isCustomer && !isOwner && status !== BookingStatus.CANCELLED) {
    throw AppError.forbidden("Customers may only cancel bookings");
  }

  if (!ALLOWED_TRANSITIONS[booking.status].includes(status)) {
    throw AppError.badRequest(`Cannot transition booking from ${booking.status} to ${status}`);
  }

  return prisma.booking.update({ where: { id: bookingId }, data: { status } });
}
