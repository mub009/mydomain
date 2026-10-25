<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\CategoryController;
use App\Http\Controllers\Controller;
use App\Http\Controllers\SearchController;
use App\Support\CategoryIcons;
use App\Support\InternalApi;
use App\Support\VisitorLocation;
use Illuminate\Http\Request;

class HomeController extends Controller
{
    private const MAX_PLACEHOLDER_TERMS = 10;

    public function __invoke(Request $request)
    {
        $location = VisitorLocation::from($request);
        $geo = $location['geo'];
        $page = max(1, (int) $request->query('page', 1));

        $categories = InternalApi::tryCall([CategoryController::class, 'index'])['data'] ?? [];
        $results = InternalApi::tryCall([SearchController::class, 'index'], array_filter([
            'city' => $geo ? null : ($location['city'] ?: null),
            'lat' => $geo['lat'] ?? null,
            'lng' => $geo['lng'] ?? null,
            'sort' => $geo ? 'distance' : 'rating',
            'page' => $page,
        ], fn ($v) => $v !== null));

        // Rotating placeholder examples for the search box: real category
        // names first, topped up with curated showcase terms, deduplicated
        // and capped so the cycle stays short.
        $terms = collect($categories)->pluck('name')
            ->merge(collect(CategoryIcons::SHOWCASE)->flatMap(fn ($g) => array_column($g['items'], 'label')))
            ->unique()->take(self::MAX_PLACEHOLDER_TERMS)->values();

        return view('pages.home', [
            'city' => $location['city'],
            'geo' => $geo,
            'categories' => $categories,
            'results' => $results['data'] ?? [],
            'meta' => $results['meta'] ?? ['total' => 0, 'totalPages' => 1, 'page' => $page],
            'error' => $results === null ? 'Could not load businesses right now.' : null,
            'placeholderTerms' => $terms,
        ]);
    }
}
