<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\CategoryController;
use App\Http\Controllers\Controller;
use App\Http\Controllers\SearchController;
use App\Support\InternalApi;
use App\Support\VisitorLocation;
use Illuminate\Http\Request;

class SearchPageController extends Controller
{
    public const SORT_OPTIONS = ['relevance' => 'Relevance', 'rating' => 'Top rated', 'distance' => 'Nearest', 'newest' => 'Newest'];

    public const RATING_OPTIONS = ['' => 'Any rating', '4' => '4★ & above', '3' => '3★ & above'];

    // A label for discovery, not a different feature set — the same
    // directory and search just filtered by who a listing serves.
    public const BUSINESS_TYPE_OPTIONS = ['' => 'All businesses', 'B2C' => 'Consumer (B2C)', 'B2B' => 'Business (B2B)'];

    public const RADIUS_OPTIONS = ['5', '10', '25', '50', '100'];

    public function __invoke(Request $request)
    {
        $location = VisitorLocation::from($request);
        $geo = $location['geo'];
        $city = $location['city'];

        $str = fn (string $key) => is_string($request->query($key)) ? trim($request->query($key)) : '';
        $filters = [
            'category' => $str('category'),
            'businessType' => in_array($str('businessType'), ['B2C', 'B2B'], true) ? $str('businessType') : '',
            'q' => $str('q'),
            'sort' => array_key_exists($str('sort'), self::SORT_OPTIONS) ? $str('sort') : 'relevance',
            'minRating' => in_array($str('minRating'), ['3', '4'], true) ? $str('minRating') : '',
            // A 10km default silently hid everything when the visitor's
            // location was far from any listing; a directory reaches wider.
            'radiusKm' => in_array($str('radiusKm'), self::RADIUS_OPTIONS, true) ? $str('radiusKm') : '50',
        ];
        $page = max(1, (int) $request->query('page', 1));

        $categories = InternalApi::tryCall([CategoryController::class, 'index'])['data'] ?? [];
        $category = collect($categories)->firstWhere('slug', $filters['category']);

        $results = InternalApi::tryCall([SearchController::class, 'index'], array_filter([
            'q' => $filters['q'] ?: null,
            'categorySlug' => $filters['category'] ?: null,
            'businessType' => $filters['businessType'] ?: null,
            'city' => $geo ? null : ($city ?: null),
            'lat' => $geo['lat'] ?? null,
            'lng' => $geo['lng'] ?? null,
            'radiusKm' => $geo ? $filters['radiusKm'] : null,
            'minRating' => $filters['minRating'] ?: null,
            'sort' => $geo && $filters['sort'] === 'relevance' ? 'distance' : $filters['sort'],
            'page' => $page,
        ], fn ($v) => $v !== null));

        // The heading mirrors what was actually searched: category and/or
        // term, narrowed to the chosen location.
        $locationLabel = $geo ? 'Near you' : ($city ?: 'All locations');
        $subject = $category['name'] ?? ($filters['q'] ? "“{$filters['q']}”" : ($filters['businessType'] === 'B2B' ? 'B2B Suppliers' : 'Businesses'));
        $heading = "Popular {$subject}".($geo || $city ? " in {$locationLabel}" : '');

        return view('pages.search', [
            'filters' => $filters,
            'city' => $city,
            'geo' => $geo,
            'categories' => $categories,
            'category' => $category,
            'heading' => $heading,
            'locationLabel' => $locationLabel,
            'results' => $results['data'] ?? [],
            'meta' => $results['meta'] ?? ['total' => 0, 'totalPages' => 1, 'page' => $page],
            'error' => $results === null ? 'Could not load businesses right now.' : null,
        ]);
    }

    // A light "signal" badge derived from the listing's own numbers.
    public static function signalBadge(array $b, int $index): ?array
    {
        if ($b['avgRating'] >= 4.5 && $b['reviewCount'] >= 3) {
            return ['label' => 'Top Rated', 'icon' => 'star', 'tint' => 'bg-amber-50 text-amber-700'];
        }
        if (($b['viewCount'] ?? 0) > 50 || $index === 0) {
            return ['label' => 'Top Search', 'icon' => 'trending-up', 'tint' => 'bg-sky-50 text-sky-700'];
        }
        if ($b['reviewCount'] >= 5) {
            return ['label' => 'Popular', 'icon' => 'flame', 'tint' => 'bg-orange-50 text-orange-700'];
        }

        return null;
    }

    public static function ratingTint(float $rating): string
    {
        return match (true) {
            $rating >= 4 => 'bg-emerald-600',
            $rating >= 3 => 'bg-lime-600',
            $rating > 0 => 'bg-amber-500',
            default => 'bg-gray-400',
        };
    }

    // The current URL with some query keys changed or removed; any filter
    // change restarts from the first page.
    public static function urlWith(array $patch): string
    {
        $query = request()->query();
        foreach ($patch as $key => $value) {
            if ($value === null || $value === '') {
                unset($query[$key]);
            } else {
                $query[$key] = $value;
            }
        }
        if (! array_key_exists('page', $patch)) {
            unset($query['page']);
        }
        $qs = http_build_query($query);

        return '/search'.($qs ? "?{$qs}" : '');
    }
}
