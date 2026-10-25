<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\ClassifiedCategory;
use App\Models\ClassifiedListing;
use App\Models\ClassifiedListingPhoto;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\Pagination;
use App\Support\Uploads\ClassifiedPhotoCleaner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClassifiedListingController extends Controller
{
    // How long a listing stays ACTIVE before classifieds:expire (see
    // routes/console.php) flips it to EXPIRED — 2 months, both for a new
    // post and for renew()'s bump back to a fresh window.
    private const RENEW_DAYS = 60;

    private function authorizeManage(array $actor, ClassifiedListing $listing): void
    {
        if ($actor['role'] !== 'ADMIN' && $actor['sub'] !== $listing->sellerId) {
            throw ApiException::forbidden('You do not own this listing');
        }
    }

    private function slugify(string $value): string
    {
        $slug = strtolower($value);
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
        $slug = trim($slug, '-');

        return $slug !== '' ? substr($slug, 0, 140) : 'item';
    }

    // Public browse/search — mirrors SearchController's Haversine approach
    // for "near me" filtering, scoped to only ever show ACTIVE listings.
    public function index(Request $request)
    {
        $data = $request->validate([
            'q' => ['sometimes', 'nullable', 'string', 'max:150'],
            'categoryId' => ['sometimes', 'nullable', 'uuid'],
            'condition' => ['sometimes', 'nullable', 'in:NEW,USED'],
            'minPriceCents' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'maxPriceCents' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'city' => ['sometimes', 'nullable', 'string', 'max:100'],
            'lat' => ['sometimes', 'nullable', 'numeric', 'min:-90', 'max:90'],
            'lng' => ['sometimes', 'nullable', 'numeric', 'min:-180', 'max:180'],
            'radiusKm' => ['sometimes', 'nullable', 'numeric', 'min:0.5', 'max:200'],
            'sort' => ['sometimes', 'nullable', 'in:newest,price_asc,price_desc,distance'],
            'page' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'pageSize' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $lat = $data['lat'] ?? null;
        $lng = $data['lng'] ?? null;
        $radiusKm = $data['radiusKm'] ?? null;
        $hasGeo = $lat !== null && $lng !== null;
        $pagination = Pagination::parse($request->query());

        $query = ClassifiedListing::where('status', 'ACTIVE');

        if ($q = $data['q'] ?? null) {
            $query->where(fn ($w) => $w->where('title', 'like', "%{$q}%")->orWhere('description', 'like', "%{$q}%"));
        }
        if ($categoryId = $data['categoryId'] ?? null) {
            $query->where('categoryId', $categoryId);
        }
        if ($condition = $data['condition'] ?? null) {
            $query->where('condition', $condition);
        }
        if (isset($data['minPriceCents'])) {
            $query->where('priceCents', '>=', $data['minPriceCents']);
        }
        if (isset($data['maxPriceCents'])) {
            $query->where('priceCents', '<=', $data['maxPriceCents']);
        }
        if ($city = $data['city'] ?? null) {
            $query->where('city', 'like', $city);
        }

        $distanceExpr = null;
        if ($hasGeo) {
            $distanceExpr = '(6371 * acos(least(1, greatest(-1,
                cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) +
                sin(radians(?)) * sin(radians(latitude))
            ))))';
            $query->whereNotNull('latitude')->whereNotNull('longitude');
            // A plain WHERE (not a HAVING on the aliased column below) so
            // count() can safely strip the select/order clauses without
            // losing the radius filter itself.
            if ($radiusKm) {
                $query->whereRaw("{$distanceExpr} <= ?", [$lat, $lng, $lat, $radiusKm]);
            }
            $query->selectRaw("classified_listings.*, {$distanceExpr} as distance_km", [$lat, $lng, $lat]);
        }

        $total = (clone $query)->count();

        match ($data['sort'] ?? ($hasGeo ? 'distance' : 'newest')) {
            'price_asc' => $query->orderBy('priceCents'),
            'price_desc' => $query->orderByDesc('priceCents'),
            'distance' => $hasGeo ? $query->orderBy('distance_km') : $query->orderByDesc('bumpedAt'),
            default => $query->orderByDesc('bumpedAt'),
        };

        $items = $query->skip($pagination['skip'])->take($pagination['take'])
            ->with(['category', 'photos' => fn ($p) => $p->limit(1)])
            ->get();

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    public function mine(Request $request)
    {
        $actor = $request->attributes->get('auth');
        $request->validate(['status' => ['sometimes', 'nullable', 'in:ACTIVE,SOLD,PAUSED,EXPIRED,REMOVED']]);
        $pagination = Pagination::parse($request->query());

        $query = ClassifiedListing::where('sellerId', $actor['sub']);
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $total = (clone $query)->count();
        $items = $query->orderByDesc('createdAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with(['category', 'photos' => fn ($p) => $p->limit(1)])
            ->get();

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    // Bulk lookup for a "recently viewed" strip built from ids kept in the
    // browser's localStorage — unlike show(), this must NOT bump viewCount,
    // or just reopening the browse page would inflate a seller's stats.
    public function batch(Request $request)
    {
        $data = $request->validate(['ids' => ['required', 'string']]);
        $ids = array_slice(array_filter(array_map('trim', explode(',', $data['ids']))), 0, 20);

        $listings = ClassifiedListing::whereIn('id', $ids)
            ->where('status', 'ACTIVE')
            ->with(['category', 'photos' => fn ($p) => $p->limit(1)])
            ->get()
            ->sortBy(fn ($l) => array_search($l->id, $ids))
            ->values();

        return ApiResponse::ok($listings);
    }

    public function show(Request $request, string $id)
    {
        $listing = ClassifiedListing::with(['category', 'photos', 'seller:id,firstName,lastName,avatarUrl,createdAt'])->find($id);
        if (! $listing) {
            throw ApiException::notFound('Listing not found');
        }

        // A quick, unauthenticated view bump — good enough for "listing
        // statistics" without needing a distinct-viewer dedup table.
        $listing->increment('viewCount');

        return ApiResponse::ok($listing);
    }

    // A seller's public storefront within classifieds — their other active
    // listings, for a buyer who found one item and wants to see more.
    public function sellerProfile(Request $request, string $sellerId)
    {
        $seller = User::select('id', 'firstName', 'lastName', 'avatarUrl', 'createdAt')->find($sellerId);
        if (! $seller) {
            throw ApiException::notFound('Seller not found');
        }

        $pagination = Pagination::parse($request->query());
        $query = ClassifiedListing::where('sellerId', $sellerId)->where('status', 'ACTIVE');
        $total = (clone $query)->count();
        $listings = $query->orderByDesc('bumpedAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with(['category', 'photos' => fn ($p) => $p->limit(1)])
            ->get();

        return ApiResponse::ok([
            'seller' => $seller,
            'listings' => $listings,
            'meta' => ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total],
        ]);
    }

    private function rules(bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'title' => [$required, 'string', 'min:3', 'max:150'],
            'description' => ['nullable', 'string', 'max:4000'],
            'categoryId' => [$required, 'uuid'],
            'condition' => [$required, 'in:NEW,USED'],
            'priceCents' => [$required, 'integer', 'min:0', 'max:100000000'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'city' => [$required, 'string', 'min:1', 'max:100'],
            'state' => ['sometimes', 'nullable', 'string', 'max:50'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'min:-90', 'max:90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'min:-180', 'max:180'],
            'contactPhone' => [$required, 'string', 'min:7', 'max:20'],
            'whatsappEnabled' => ['sometimes', 'boolean'],
            'whatsappNumber' => ['nullable', 'string', 'min:7', 'max:20'],
            'photos' => [$required, 'array', 'min:1', 'max:10'],
            'photos.*' => ['url'],
        ];
    }

    public function store(Request $request)
    {
        $actor = $request->attributes->get('auth');
        $data = $request->validate($this->rules());
        $photos = $data['photos'];
        unset($data['photos']);

        if (! ClassifiedCategory::find($data['categoryId'])) {
            throw ApiException::badRequest('Invalid categoryId');
        }

        $listing = DB::transaction(function () use ($data, $photos, $actor) {
            $listing = ClassifiedListing::create([
                ...$data,
                'sellerId' => $actor['sub'],
                'slug' => $this->slugify($data['title']),
                'currency' => $data['currency'] ?? 'INR',
                'status' => 'ACTIVE',
                'bumpedAt' => now(),
                'expiresAt' => now()->addDays(self::RENEW_DAYS),
            ]);

            foreach ($photos as $i => $url) {
                ClassifiedListingPhoto::create(['listingId' => $listing->id, 'url' => $url, 'sortOrder' => $i]);
            }

            return $listing;
        });

        return ApiResponse::created($listing->load('photos', 'category'));
    }

    public function update(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $listing = ClassifiedListing::find($id);
        if (! $listing) {
            throw ApiException::notFound('Listing not found');
        }
        $this->authorizeManage($actor, $listing);

        $data = $request->validate($this->rules(partial: true));
        $photos = $data['photos'] ?? null;
        unset($data['photos']);

        if (isset($data['categoryId']) && ! ClassifiedCategory::find($data['categoryId'])) {
            throw ApiException::badRequest('Invalid categoryId');
        }
        if (isset($data['title'])) {
            $data['slug'] = $this->slugify($data['title']);
        }

        DB::transaction(function () use ($listing, $data, $photos) {
            $listing->update($data);

            if ($photos !== null) {
                ClassifiedListingPhoto::where('listingId', $listing->id)->delete();
                foreach ($photos as $i => $url) {
                    ClassifiedListingPhoto::create(['listingId' => $listing->id, 'url' => $url, 'sortOrder' => $i]);
                }
            }
        });

        return ApiResponse::ok($listing->fresh(['photos', 'category']));
    }

    public function destroy(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $listing = ClassifiedListing::with('photos')->find($id);
        if (! $listing) {
            throw ApiException::notFound('Listing not found');
        }
        $this->authorizeManage($actor, $listing);
        ClassifiedPhotoCleaner::purge($listing);
        $listing->delete();

        return ApiResponse::noContent();
    }

    private function transition(Request $request, string $id, array $update): ClassifiedListing
    {
        $actor = $request->attributes->get('auth');
        $listing = ClassifiedListing::find($id);
        if (! $listing) {
            throw ApiException::notFound('Listing not found');
        }
        $this->authorizeManage($actor, $listing);
        $listing->update($update);

        return $listing;
    }

    public function markSold(Request $request, string $id)
    {
        $listing = $this->transition($request, $id, ['status' => 'SOLD', 'soldAt' => now()]);
        // A sold listing has no path back to needing its photos again (no
        // "unsell" action), so the uploaded files can be freed immediately.
        ClassifiedPhotoCleaner::purge($listing);

        return ApiResponse::ok($listing->fresh(['photos', 'category']));
    }

    public function pause(Request $request, string $id)
    {
        return ApiResponse::ok($this->transition($request, $id, ['status' => 'PAUSED']));
    }

    // Resumes a paused (or expired) listing back to live search results.
    public function activate(Request $request, string $id)
    {
        return ApiResponse::ok($this->transition($request, $id, ['status' => 'ACTIVE']));
    }

    // Bumps the listing back to the top of "newest" sort and pushes its
    // expiry out another RENEW_DAYS — also revives an EXPIRED listing.
    public function renew(Request $request, string $id)
    {
        return ApiResponse::ok($this->transition($request, $id, [
            'status' => 'ACTIVE',
            'bumpedAt' => now(),
            'expiresAt' => now()->addDays(self::RENEW_DAYS),
        ]));
    }
}
