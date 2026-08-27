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

class StorefrontController extends Controller
{
    public function publicProducts(Request $request, string $slug)
    {
        $site = Business::where('slug', $slug)->with('site')->first()?->site;
        if (! $site || ! $site->isPublished || $site->siteType !== 'ECOMMERCE') {
            throw ApiException::notFound('This shop is not open for orders');
        }

        $request->validate(['search' => ['sometimes', 'string', 'max:120']]);
        $pagination = Pagination::parse($request->query());

        $query = Product::where('businessId', $site->businessId)->where('isActive', true);
        if ($search = $request->query('search')) {
            $query->where('name', 'like', "%{$search}%");
        }

        $total = (clone $query)->count();
        $items = $query->orderBy('sortOrder')->orderByDesc('createdAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->get(['id', 'name', 'slug', 'description', 'priceCents', 'compareAtCents', 'currency', 'imageUrl', 'trackStock', 'stock']);

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    // Human-friendly and hard to guess by counting: MK-<base36 time>-<random>.
    private function makeOrderNumber(): string
    {
        $stamp = strtoupper(base_convert((string) round(microtime(true) * 1000), 10, 36));
        $rand = strtoupper(str_pad(base_convert((string) random_int(0, 36 ** 3 - 1), 10, 36), 3, '0', STR_PAD_LEFT));

        return "MK-{$stamp}-{$rand}";
    }

    /**
     * Places an order against a published storefront. Prices, availability
     * and totals are all recomputed here — the basket the browser posts is
     * only a list of product ids and quantities, so a tampered cart cannot
     * change what is charged.
     */
    public function checkout(Request $request, string $slug)
    {
        $auth = $request->attributes->get('auth');
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.productId' => ['required', 'string'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
            'customerName' => ['required', 'string', 'min:2', 'max:120'],
            'customerPhone' => ['required', 'string', 'min:7', 'max:20'],
            'customerEmail' => ['sometimes', 'nullable', 'email', 'max:160'],
            'addressLine1' => ['required', 'string', 'min:3', 'max:200'],
            'addressLine2' => ['sometimes', 'nullable', 'string', 'max:200'],
            'city' => ['required', 'string', 'min:2', 'max:120'],
            'postalCode' => ['sometimes', 'nullable', 'string', 'max:20'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        $business = Business::where('slug', $slug)->with('site')->first();
        if (! $business) {
            throw ApiException::notFound('Shop not found');
        }

        $site = $business->site;
        if (! $site || ! $site->isPublished || $site->siteType !== 'ECOMMERCE') {
            throw ApiException::badRequest('This shop is not open for orders');
        }

        // Fold duplicate lines so "add to cart" twice is one line of quantity 2.
        $wanted = [];
        foreach ($data['items'] as $line) {
            $wanted[$line['productId']] = ($wanted[$line['productId']] ?? 0) + $line['quantity'];
        }

        $products = Product::where('businessId', $business->id)
            ->whereIn('id', array_keys($wanted))->where('isActive', true)->get()->keyBy('id');
        if ($products->count() !== count($wanted)) {
            throw ApiException::badRequest('Some items are no longer available. Please review your cart.');
        }

        $lines = [];
        foreach ($wanted as $productId => $quantity) {
            $product = $products->get($productId);
            if ($product->trackStock && $product->stock < $quantity) {
                throw ApiException::badRequest(
                    $product->stock > 0
                        ? "Only {$product->stock} left of \"{$product->name}\""
                        : "\"{$product->name}\" is out of stock"
                );
            }
            $lines[] = [
                'productId' => $product->id,
                'name' => $product->name,
                'imageUrl' => $product->imageUrl,
                'unitPriceCents' => $product->priceCents,
                'quantity' => $quantity,
                'lineTotalCents' => $product->priceCents * $quantity,
            ];
        }

        $subtotalCents = array_sum(array_column($lines, 'lineTotalCents'));
        $qualifiesForFreeDelivery = $site->freeDeliveryAboveCents !== null && $subtotalCents >= $site->freeDeliveryAboveCents;
        $deliveryFeeCents = $qualifiesForFreeDelivery ? 0 : $site->deliveryFeeCents;
        $currency = $products->first()->currency ?? 'INR';

        $order = DB::transaction(function () use ($business, $auth, $data, $subtotalCents, $deliveryFeeCents, $currency, $lines, $products) {
            $order = Order::create([
                'businessId' => $business->id,
                'orderNumber' => $this->makeOrderNumber(),
                'customerId' => $auth['sub'] ?? null,
                'customerName' => $data['customerName'],
                'customerPhone' => $data['customerPhone'],
                'customerEmail' => $data['customerEmail'] ?? null,
                'addressLine1' => $data['addressLine1'],
                'addressLine2' => $data['addressLine2'] ?? null,
                'city' => $data['city'],
                'postalCode' => $data['postalCode'] ?? null,
                'notes' => $data['notes'] ?? null,
                'status' => 'PENDING',
                'paymentMethod' => 'COD',
                'subtotalCents' => $subtotalCents,
                'deliveryFeeCents' => $deliveryFeeCents,
                'totalCents' => $subtotalCents + $deliveryFeeCents,
                'currency' => $currency,
            ]);

            foreach ($lines as $line) {
                $order->items()->create($line);
            }

            // Only shops that actually count stock have it decremented.
            foreach ($lines as $line) {
                $product = $products->get($line['productId']);
                if ($product->trackStock) {
                    $product->decrement('stock', $line['quantity']);
                }
            }

            return $order->load('items');
        });

        // A "new order" email to the shop (Node's notifyNewOrder) is not part
        // of this port — see backend-laravel/README.md (email sending).

        return ApiResponse::created([
            'id' => $order->id,
            'orderNumber' => $order->orderNumber,
            'status' => $order->status,
            'subtotalCents' => $order->subtotalCents,
            'deliveryFeeCents' => $order->deliveryFeeCents,
            'totalCents' => $order->totalCents,
            'currency' => $order->currency,
            'placedAt' => $order->placedAt,
            'items' => $order->items->map(fn ($i) => ['name' => $i->name, 'quantity' => $i->quantity, 'lineTotalCents' => $i->lineTotalCents]),
        ]);
    }
}
