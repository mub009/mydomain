import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth, requirePrivilege } from "@/middleware/auth";
import { createBookingSchema, updateBookingStatusSchema } from "./bookings.validation";
import {
  createBookingHandler,
  listBusinessBookingsHandler,
  listMyBookingsHandler,
  updateBookingStatusHandler,
} from "./bookings.controller";

export const bookingsRouter = Router();

const bookingsPriv = requirePrivilege("MANAGE_BOOKINGS");

bookingsRouter.post(
  "/businesses/:businessId/bookings",
  requireAuth,
  validate({ body: createBookingSchema }),
  asyncHandler(createBookingHandler),
);
bookingsRouter.get("/businesses/:businessId/bookings", requireAuth, bookingsPriv, asyncHandler(listBusinessBookingsHandler));
bookingsRouter.get("/bookings/mine", requireAuth, asyncHandler(listMyBookingsHandler));
bookingsRouter.patch(
  "/bookings/:bookingId/status",
  requireAuth,
  bookingsPriv,
  validate({ body: updateBookingStatusSchema }),
  asyncHandler(updateBookingStatusHandler),
);
