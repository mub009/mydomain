<?php

namespace App\Http\Controllers;

use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SearchController extends Controller
{
    // Earth-radius Haversine distance search. For very large catalogs this
    // would move to a dedicated search index (Elasticsearch/Meilisearch) or
    // spatial indexing (MySQL's ST_Distance_Sphere on a POINT column); the
    // SQL shape here is written to make that swap contained.
    public function index(Request $request)
    {
        $data = $request->validate([
            'q' => ['sometimes', 'string', 'max:150'],
            'categorySlug' => ['sometimes', 'string', 'max:100'],
            'city' => ['sometimes', 'string', 'max:100'],
            'lat' => ['sometimes', 'numeric', 'min:-90', 'max:90'],
            'lng' => ['sometimes', 'numeric', 'min:-180', 'max:180'],
            'radiusKm' => ['sometimes', 'numeric', 'min:0.5', 'max:100'],
            'minRating' => ['sometimes', 'numeric', 'min:0', 'max:5'],
            'sort' => ['sometimes', 'in:relevance,rating,distance,newest'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'pageSize' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $q = $data['q'] ?? null;
        $categorySlug = $data['categorySlug'] ?? null;
        $city = $data['city'] ?? null;
        $lat = $data['lat'] ?? null;
        $lng = $data['lng'] ?? null;
        $radiusKm = $data['radiusKm'] ?? 10;
        $minRating = $data['minRating'] ?? null;
        $sort = $data['sort'] ?? 'relevance';
        $page = $data['page'] ?? 1;
        $pageSize = $data['pageSize'] ?? 20;
        $offset = ($page - 1) * $pageSize;
        $hasGeo = $lat !== null && $lng !== null;

        $conditions = ['b.status = ?'];
        $bindings = ['PUBLISHED'];

        if ($q) {
            $conditions[] = '(b.name LIKE ? OR b.description LIKE ?)';
            $bindings[] = "%{$q}%";
            $bindings[] = "%{$q}%";
        }
        if ($categorySlug) {
            $conditions[] = 'c.slug = ?';
            $bindings[] = $categorySlug;
        }
        if ($city) {
            $conditions[] = 'b.city LIKE ?';
            $bindings[] = $city;
        }
        if ($minRating !== null) {
            $conditions[] = 'b.avgRating >= ?';
            $bindings[] = $minRating;
        }

        $distanceExpr = 'NULL';
        $distanceBindings = [];
        if ($hasGeo) {
            $distanceExpr = '(6371 * acos(least(1, greatest(-1,
                cos(radians(?)) * cos(radians(b.latitude)) * cos(radians(b.longitude) - radians(?)) +
                sin(radians(?)) * sin(radians(b.latitude))
            ))))';
            $distanceBindings = [$lat, $lng, $lat];
            $conditions[] = "{$distanceExpr} <= ?";
            $bindings = [...$bindings, ...$distanceBindings, $radiusKm];
        }

        $where = implode(' AND ', $conditions);

        $orderBy = match (true) {
            $sort === 'distance' && $hasGeo => '(distance_km IS NULL) ASC, distance_km ASC',
            $sort === 'rating' => 'b.avgRating DESC, b.reviewCount DESC',
            $sort === 'newest' => 'b.createdAt DESC',
            default => 'b.avgRating DESC, b.reviewCount DESC',
        };

        $selectBindings = $hasGeo ? $distanceBindings : [];
        $rows = DB::select("
            SELECT
                b.id, b.name, b.slug, b.description, b.city, b.state, b.latitude, b.longitude,
                b.avgRating AS avgRating, b.reviewCount AS reviewCount, b.logoUrl AS logoUrl,
                b.phone, b.addressLine1 AS addressLine1, b.isVerified AS isVerified,
                c.name AS categoryName, c.slug AS categorySlug,
                (SELECT p.url FROM business_photos p WHERE p.businessId = b.id ORDER BY p.sortOrder ASC LIMIT 1) AS photoUrl,
                {$distanceExpr} AS distance_km
            FROM businesses b
            JOIN categories c ON c.id = b.categoryId
            WHERE {$where}
            ORDER BY {$orderBy}
            LIMIT {$pageSize} OFFSET {$offset}
        ", [...$selectBindings, ...$bindings]);

        $countRows = DB::select("
            SELECT COUNT(*) AS count
            FROM businesses b
            JOIN categories c ON c.id = b.categoryId
            WHERE {$where}
        ", $bindings);

        $items = array_map(function ($r) {
            $r = (array) $r;

            return [
                'id' => $r['id'], 'name' => $r['name'], 'slug' => $r['slug'], 'description' => $r['description'],
                'city' => $r['city'], 'state' => $r['state'], 'latitude' => (float) $r['latitude'], 'longitude' => (float) $r['longitude'],
                'avgRating' => (float) $r['avgRating'], 'reviewCount' => (int) $r['reviewCount'], 'logoUrl' => $r['logoUrl'],
                'categoryName' => $r['categoryName'], 'categorySlug' => $r['categorySlug'],
                'distanceKm' => $r['distance_km'] !== null ? (float) $r['distance_km'] : null,
                'phone' => $r['phone'], 'addressLine1' => $r['addressLine1'], 'isVerified' => (bool) $r['isVerified'],
                'photoUrl' => $r['photoUrl'],
            ];
        }, $rows);

        return ApiResponse::paginated($items, ['page' => $page, 'pageSize' => $pageSize, 'total' => (int) ($countRows[0]->count ?? 0)]);
    }

    public function cities()
    {
        $rows = DB::table('businesses')
            ->select('city', 'state', DB::raw('COUNT(*) as businessCount'))
            ->where('status', 'PUBLISHED')
            ->groupBy('city', 'state')
            ->orderByDesc('businessCount')
            ->limit(12)
            ->get()
            ->map(fn ($r) => ['city' => $r->city, 'state' => $r->state, 'businessCount' => (int) $r->businessCount]);

        return ApiResponse::ok($rows);
    }
}
