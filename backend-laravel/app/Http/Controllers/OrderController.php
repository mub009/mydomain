<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\Order;
use App\Models\Product;
use App\Support\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    private const STATUSES = ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

    private function assertOwnerOrAdmin(array $actor, string $ownerId): void
    {
        if ($actor['role'] === 'ADMIN') {
            return;
        }
        if ($actor['sub'] !== $ownerId) {
            throw ApiException::forbidden('You do not own this business');
        }
    }

    private function ownedBusiness(array $actor, string $businessId): Business
    {
        $business = Business::find($businessId);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        $this->assertOwnerOrAdmin($actor, $business->ownerId);

        return $business;
    }

    // Headline numbers for the dashboard. Cancelled orders are excluded from
    // revenue — they were never earned.
    private function orderSummary(string $businessId): array
    {
        $startOfToday = now()->startOfDay();

        $byStatus = Order::where('businessId', $businessId)->selectRaw('status, COUNT(*) as cnt')->groupBy('status')->pluck('cnt', 'status');
        $total = Order::where('businessId', $businessId)->count();
        $earned = (int) Order::where('businessId', $businessId)->where('status', '!=', 'CANCELLED')->sum('totalCents');
        $today = Order::where('businessId', $businessId)->where('placedAt', '>=', $startOfToday)->count();

        return [
            'total' => $total,
            'revenueCents' => $earned,
            'todayCount' => $today,
            'byStatus' => (object) $byStatus->map(fn ($v) => (int) $v)->toArray(),
        ];
    }

    public function index(Request $request, string $businessId)
    {
        $actor = $request->attributes->get('auth');
        $this->ownedBusiness($actor, $businessId);

        $request->validate([
            'status' => ['sometimes', 'nullable', 'in:'.implode(',', self::STATUSES)],
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);
        $pagination = Pagination::parse($request->query());

        $query = Order::where('businessId', $businessId);
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('orderNumber', 'like', "%{$search}%")
                    ->orWhere('customerName', 'like', "%{$search}%")
                    ->orWhere('customerPhone', 'like', "%{$search}%");
            });
        }

        $total = (clone $query)->count();
        $items = $query->orderByDesc('placedAt')->skip($pagination['skip'])->take($pagination['take'])->with('items')->get();

        return response()->json([
            'success' => true,
            'data' => $items,
            'meta' => [
                'page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total,
                'totalPages' => $pagination['pageSize'] > 0 ? ((int) ceil($total / $pagination['pageSize']) ?: 1) : 1,
            ],
            'summary' => $this->orderSummary($businessId),
        ]);
    }

    public function show(Request $request, string $id, string $orderId)
    {
        $actor = $request->attributes->get('auth');
        $order = Order::with(['items', 'business:id,ownerId,name'])->find($orderId);
        if (! $order) {
            throw ApiException::notFound('Order not found');
        }
        $this->assertOwnerOrAdmin($actor, $order->business->ownerId);

        return ApiResponse::ok($order);
    }

    public function updateStatus(Request $request, string $id, string $orderId)
    {
        $actor = $request->attributes->get('auth');
        $data = $request->validate(['status' => ['required', 'in:'.implode(',', self::STATUSES)]]);

        $order = Order::with(['items', 'business:id,ownerId,name'])->find($orderId);
        if (! $order) {
            throw ApiException::notFound('Order not found');
        }
        $this->assertOwnerOrAdmin($actor, $order->business->ownerId);

        if ($order->status === $data['status']) {
            return ApiResponse::ok($order);
        }

        $order = DB::transaction(function () use ($order, $data) {
            // Cancelling puts tracked stock back on the shelf; it must only
            // happen on the transition, never on a repeated cancel.
            if ($data['status'] === 'CANCELLED' && $order->status !== 'CANCELLED') {
                foreach ($order->items as $item) {
                    if (! $item->productId) {
                        continue;
                    }
                    $product = Product::find($item->productId);
                    if ($product?->trackStock) {
                        $product->increment('stock', $item->quantity);
                    }
                }
            }

            $order->update(['status' => $data['status']]);

            return $order->fresh('items');
        });

        return ApiResponse::ok($order);
    }

    // Who has bought from this shop, built from the orders themselves.
    // Guests never create an account, so the phone number is the identity
    // grouped on.
    public function customers(Request $request, string $businessId)
    {
        $actor = $request->attributes->get('auth');
        $this->ownedBusiness($actor, $businessId);

        $request->validate(['search' => ['sometimes', 'nullable', 'string', 'max:120']]);
        $pagination = Pagination::parse($request->query());

        $query = Order::where('businessId', $businessId);
        if ($search = $request->query('search')) {
            $query->where(fn ($q) => $q->where('customerName', 'like', "%{$search}%")->orWhere('customerPhone', 'like', "%{$search}%"));
        }

        $distinctCount = (clone $query)->distinct('customerPhone')->count('customerPhone');

        $grouped = (clone $query)
            ->selectRaw('customerPhone, COUNT(*) as order_count, SUM(totalCents) as total_spent, MAX(placedAt) as last_at, MIN(placedAt) as first_at')
            ->groupBy('customerPhone')
            ->orderByDesc('total_spent')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->get();

        $items = $grouped->map(function ($row) use ($businessId) {
            $latest = Order::where('businessId', $businessId)->where('customerPhone', $row->customerPhone)
                ->orderByDesc('placedAt')
                ->first(['customerName', 'customerEmail', 'city', 'addressLine1', 'status', 'orderNumber', 'currency']);

            return [
                'phone' => $row->customerPhone,
                'name' => $latest->customerName ?? '',
                'email' => $latest->customerEmail ?? null,
                'city' => $latest->city ?? '',
                'address' => $latest->addressLine1 ?? '',
                'lastOrderNumber' => $latest->orderNumber ?? '',
                'lastOrderStatus' => $latest->status ?? null,
                'currency' => $latest->currency ?? 'INR',
                'orderCount' => (int) $row->order_count,
                'totalSpentCents' => (int) ($row->total_spent ?? 0),
                'firstOrderAt' => $row->first_at,
                'lastOrderAt' => $row->last_at,
            ];
        });

        $pageSize = $pagination['pageSize'];

        return response()->json([
            'success' => true,
            'data' => $items,
            'meta' => [
                'page' => $pagination['page'], 'pageSize' => $pageSize, 'total' => $distinctCount,
                'totalPages' => $pageSize > 0 ? ((int) ceil($distinctCount / $pageSize) ?: 1) : 1,
            ],
        ]);
    }
}
