<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\ClassifiedFavorite;
use App\Models\ClassifiedListing;
use App\Support\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClassifiedFavoriteController extends Controller
{
    public function index(Request $request)
    {
        $actor = $request->attributes->get('auth');
        $pagination = Pagination::parse($request->query());

        $query = ClassifiedFavorite::where('userId', $actor['sub']);
        $total = (clone $query)->count();
        $favorites = $query->orderByDesc('createdAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with(['listing.category', 'listing.photos' => fn ($p) => $p->limit(1)])
            ->get();

        // Surface the listing itself — the favorite row is just the join.
        $items = $favorites->pluck('listing')->filter()->values();

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    public function store(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $listing = ClassifiedListing::find($id);
        if (! $listing) {
            throw ApiException::notFound('Listing not found');
        }

        $existing = ClassifiedFavorite::where('userId', $actor['sub'])->where('listingId', $id)->exists();
        if (! $existing) {
            DB::transaction(function () use ($actor, $id, $listing) {
                ClassifiedFavorite::create(['userId' => $actor['sub'], 'listingId' => $id]);
                $listing->increment('favoriteCount');
            });
        }

        return ApiResponse::created(['listingId' => $id]);
    }

    public function destroy(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $deleted = ClassifiedFavorite::where('userId', $actor['sub'])->where('listingId', $id)->delete();

        if ($deleted) {
            ClassifiedListing::where('id', $id)->decrement('favoriteCount');
        }

        return ApiResponse::noContent();
    }
}
