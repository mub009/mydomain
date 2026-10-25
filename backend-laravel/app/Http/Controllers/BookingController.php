<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Booking;
use App\Models\Business;
use App\Models\BusinessHours;
use App\Models\Service;
use App\Support\ApiResponse;
use App\Support\BusinessAccess;
use App\Support\Pagination;
use Carbon\Carbon;
use Illuminate\Http\Request;

class BookingController extends Controller
{
    private const ALLOWED_TRANSITIONS = [
        'PENDING' => ['CONFIRMED', 'CANCELLED'],
        'CONFIRMED' => ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
        'COMPLETED' => [],
        'CANCELLED' => [],
        'NO_SHOW' => [],
    ];

    private function timeToMinutes(string $t): int
    {
        [$h, $m] = array_map('intval', explode(':', $t));

        return $h * 60 + $m;
    }

    public function store(Request $request, string $businessId)
    {
        $auth = $request->attributes->get('auth');
        $data = $request->validate([
            'serviceId' => ['required', 'uuid'],
            'scheduledAt' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $service = Service::find($data['serviceId']);
        if (! $service || $service->businessId !== $businessId || ! $service->isActive) {
            throw ApiException::badRequest('Service not available for this business');
        }

        $scheduledAt = Carbon::parse($data['scheduledAt']);
        if ($scheduledAt->lessThanOrEqualTo(now())) {
            throw ApiException::badRequest('scheduledAt must be in the future');
        }

        $dayOfWeek = (int) $scheduledAt->dayOfWeek;
        $hours = BusinessHours::where('businessId', $businessId)->where('dayOfWeek', $dayOfWeek)->first();
        if ($hours) {
            if ($hours->isClosed) {
                throw ApiException::badRequest('Business is closed on this day');
            }
            $minutesOfDay = $scheduledAt->hour * 60 + $scheduledAt->minute;
            if ($minutesOfDay < $this->timeToMinutes($hours->openTime)
                || $minutesOfDay + $service->durationMins > $this->timeToMinutes($hours->closeTime)) {
                throw ApiException::badRequest('Requested time is outside business hours');
            }
        }

        $windowStart = $scheduledAt->copy()->subMinutes($service->durationMins);
        $windowEnd = $scheduledAt->copy()->addMinutes($service->durationMins);
        $conflict = Booking::where('businessId', $businessId)
            ->whereIn('status', ['PENDING', 'CONFIRMED'])
            ->whereBetween('scheduledAt', [$windowStart, $windowEnd])
            ->exists();
        if ($conflict) {
            throw ApiException::conflict('This time slot is already booked');
        }

        $booking = Booking::create([
            'businessId' => $businessId,
            'serviceId' => $service->id,
            'customerId' => $auth['sub'],
            'scheduledAt' => $scheduledAt,
            'status' => 'PENDING',
            'notes' => $data['notes'] ?? null,
            'priceCents' => $service->priceCents,
            'currency' => $service->currency,
        ]);

        return ApiResponse::created($booking);
    }

    public function mine(Request $request)
    {
        $auth = $request->attributes->get('auth');
        $pagination = Pagination::parse($request->query());

        $query = Booking::where('customerId', $auth['sub']);
        $total = (clone $query)->count();
        $items = $query->orderByDesc('scheduledAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with(['business', 'service'])->get();

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    public function forBusiness(Request $request, string $businessId)
    {
        $auth = $request->attributes->get('auth');
        $pagination = Pagination::parse($request->query());

        $business = Business::find($businessId);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        BusinessAccess::assertCanManage($auth, $business);

        $query = Booking::where('businessId', $businessId);
        $total = (clone $query)->count();
        $items = $query->orderByDesc('scheduledAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with(['service', 'customer:id,firstName,lastName,phone'])->get();

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    public function updateStatus(Request $request, string $bookingId)
    {
        $auth = $request->attributes->get('auth');
        $data = $request->validate(['status' => ['required', 'in:PENDING,CONFIRMED,COMPLETED,CANCELLED,NO_SHOW']]);

        $booking = Booking::with('business')->find($bookingId);
        if (! $booking) {
            throw ApiException::notFound('Booking not found');
        }

        $isManager = BusinessAccess::canManage($auth, $booking->business);
        $isCustomer = $booking->customerId === $auth['sub'];
        if (! $isManager && ! $isCustomer) {
            throw ApiException::forbidden();
        }
        if ($isCustomer && ! $isManager && $data['status'] !== 'CANCELLED') {
            throw ApiException::forbidden('Customers may only cancel bookings');
        }

        if (! in_array($data['status'], self::ALLOWED_TRANSITIONS[$booking->status], true)) {
            throw ApiException::badRequest("Cannot transition booking from {$booking->status} to {$data['status']}");
        }

        $booking->update(['status' => $data['status']]);

        return ApiResponse::ok($booking);
    }
}
