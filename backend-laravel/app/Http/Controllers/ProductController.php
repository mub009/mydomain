<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\Product;
use App\Support\ApiResponse;
use App\Support\BusinessAccess;
use App\Support\Pagination;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    private function ownedBusiness(array $actor, string $businessId): Business
    {
        $business = Business::find($businessId);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        BusinessAccess::assertCanManage($actor, $business);

        return $business;
    }

    private function slugify(string $value): string
    {
        $slug = strtolower($value);
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
        $slug = trim($slug, '-');
        $slug = substr($slug, 0, 140);

        return $slug !== '' ? $slug : 'item';
    }

    // Slugs are unique per shop, so two products called "Masala Dosa" in the
    // same catalogue get -2, -3 and so on rather than colliding.
    private function uniqueSlug(string $businessId, string $name, ?string $ignoreId = null): string
    {
        $base = $this->slugify($name);
        for ($attempt = 0; $attempt < 50; $attempt++) {
            $candidate = $attempt === 0 ? $base : "{$base}-".($attempt + 1);
            $query = Product::where('businessId', $businessId)->where('slug', $candidate);
            if ($ignoreId) {
                $query->where('id', '!=', $ignoreId);
            }
            if (! $query->exists()) {
                return $candidate;
            }
        }

        return $base.'-'.(int) round(microtime(true) * 1000);
    }

    private function assertPricing(?int $priceCents, $compareAtCents): void
    {
        if ($priceCents !== null && $priceCents < 0) {
            throw ApiException::badRequest('Price cannot be negative');
        }
        if ($compareAtCents !== null && $priceCents !== null && $compareAtCents <= $priceCents) {
            throw ApiException::badRequest('The compare-at price must be higher than the selling price');
        }
    }

    private function productRules(bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'name' => [$required, 'string', 'min:2', 'max:160'],
            'description' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'priceCents' => [$required, 'integer', 'min:0', 'max:100000000'],
            'compareAtCents' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000000'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'imageUrl' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'sku' => ['sometimes', 'nullable', 'string', 'max:60'],
            'trackStock' => ['sometimes', 'boolean'],
            'stock' => ['sometimes', 'integer', 'min:0', 'max:1000000'],
            'isActive' => ['sometimes', 'boolean'],
            'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:9999'],
        ];
    }

    public function index(Request $request, string $businessId)
    {
        $actor = $request->attributes->get('auth');
        $this->ownedBusiness($actor, $businessId);

        $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],
            'includeInactive' => ['sometimes', 'nullable', 'boolean'],
        ]);
        $pagination = Pagination::parse($request->query());

        $query = Product::where('businessId', $businessId);
        // Matches the Node behavior exactly: products include inactive ones
        // unless the caller explicitly passes includeInactive=false.
        if ($request->has('includeInactive') && ! $request->boolean('includeInactive')) {
            $query->where('isActive', true);
        }
        if ($search = $request->query('search')) {
            $query->where('name', 'like', "%{$search}%");
        }

        $total = (clone $query)->count();
        $items = $query->orderBy('sortOrder')->orderByDesc('createdAt')
            ->skip($pagination['skip'])->take($pagination['take'])->get();

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    public function store(Request $request, string $businessId)
    {
        $actor = $request->attributes->get('auth');
        $this->ownedBusiness($actor, $businessId);

        $data = $request->validate($this->productRules());
        $this->assertPricing($data['priceCents'], $data['compareAtCents'] ?? null);

        $product = Product::create([
            'businessId' => $businessId,
            'slug' => $this->uniqueSlug($businessId, $data['name']),
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'priceCents' => $data['priceCents'],
            'compareAtCents' => $data['compareAtCents'] ?? null,
            'currency' => $data['currency'] ?? 'INR',
            'imageUrl' => $data['imageUrl'] ?? null,
            'sku' => $data['sku'] ?? null,
            'trackStock' => $data['trackStock'] ?? false,
            'stock' => $data['stock'] ?? 0,
            'isActive' => $data['isActive'] ?? true,
            'sortOrder' => $data['sortOrder'] ?? 0,
        ]);

        return ApiResponse::created($product);
    }

    public function update(Request $request, string $id, string $productId)
    {
        $actor = $request->attributes->get('auth');
        $product = Product::with('business')->find($productId);
        if (! $product) {
            throw ApiException::notFound('Product not found');
        }
        BusinessAccess::assertCanManage($actor, $product->business);

        $data = $request->validate($this->productRules(partial: true));
        $this->assertPricing(
            $data['priceCents'] ?? $product->priceCents,
            array_key_exists('compareAtCents', $data) ? $data['compareAtCents'] : $product->compareAtCents,
        );

        // Keep the slug in step with a renamed product so its link stays readable.
        if (isset($data['name']) && $data['name'] !== $product->name) {
            $data['slug'] = $this->uniqueSlug($product->businessId, $data['name'], $product->id);
        }

        $product->update($data);

        return ApiResponse::ok($product);
    }

    public function destroy(Request $request, string $id, string $productId)
    {
        $actor = $request->attributes->get('auth');
        $product = Product::with('business')->find($productId);
        if (! $product) {
            throw ApiException::notFound('Product not found');
        }
        BusinessAccess::assertCanManage($actor, $product->business);

        // Order items keep a snapshot of what was bought, so removing a
        // product from the catalogue never rewrites what a customer was charged.
        $product->delete();

        return ApiResponse::ok(['id' => $productId]);
    }
}
