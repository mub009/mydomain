import { Request, Response } from "express";
import { created, ok, paginated } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as bookingsService from "./bookings.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export async function createBookingHandler(req: Request, res: Response): Promise<void> {
  created(res, await bookingsService.createBooking(actor(req).sub, req.params.businessId, req.body));
}

export async function listMyBookingsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await bookingsService.listMyBookings(actor(req).sub, req.query as any);
  paginated(res, items, meta);
}

export async function listBusinessBookingsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await bookingsService.listBusinessBookings(actor(req).sub, req.params.businessId, req.query as any);
  paginated(res, items, meta);
}

export async function updateBookingStatusHandler(req: Request, res: Response): Promise<void> {
  ok(res, await bookingsService.updateBookingStatus(actor(req), req.params.bookingId, req.body.status));
}
