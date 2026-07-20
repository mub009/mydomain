import { z } from "zod";
import { BookingStatus } from "@prisma/client";

export const createBookingSchema = z.object({
  serviceId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
  notes: z.string().max(1000).optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus),
});
