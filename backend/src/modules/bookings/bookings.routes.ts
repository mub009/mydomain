import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { requireAuth } from "@/middleware/auth";
import { createBookingSchema, updateBookingStatusSchema } from "./bookings.validation";
import {
  createBookingHandler,
  listBusinessBookingsHandler,
  listMyBookingsHandler,
  updateBookingStatusHandler,
} from "./bookings.controller";

export const bookingsRouter = Router();

bookingsRouter.post(
  "/businesses/:businessId/bookings",
  requireAuth,
  validate({ body: createBookingSchema }),
  asyncHandler(createBookingHandler),
);
bookingsRouter.get("/businesses/:businessId/bookings", requireAuth, asyncHandler(listBusinessBookingsHandler));
bookingsRouter.get("/bookings/mine", requireAuth, asyncHandler(listMyBookingsHandler));
bookingsRouter.patch(
  "/bookings/:bookingId/status",
  requireAuth,
  validate({ body: updateBookingStatusSchema }),
  asyncHandler(updateBookingStatusHandler),
);
