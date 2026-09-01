<?php

namespace App\Http\Controllers;

use App\Models\ClassifiedCategory;
use App\Models\ClassifiedConversation;
use App\Models\ClassifiedFollow;
use App\Models\ClassifiedListing;
use App\Models\ClassifiedMessage;
use App\Models\ClassifiedReport;
use App\Support\ApiResponse;

// Admin "Marketplace" tab — a read-only snapshot of what's actually
// happening in classifieds (listings, sellers, messaging, follows,
// reports), so moderation and build priorities have real numbers behind
// them instead of guesswork. Nothing here is mutable; it's all just counts.
class ClassifiedStatsController extends Controller
{
    private const STATUSES = ['ACTIVE', 'SOLD', 'PAUSED', 'EXPIRED', 'REMOVED'];

    public function overview()
    {
        $today = now()->startOfDay();
        $weekAgo = now()->subDays(7);
        $monthAgo = now()->subDays(30);

        $byStatus = ClassifiedListing::selectRaw('status, COUNT(*) as cnt')->groupBy('status')->pluck('cnt', 'status');

        $topCategoryRows = ClassifiedListing::where('status', 'ACTIVE')
            ->selectRaw('categoryId, COUNT(*) as cnt')
            ->groupBy('categoryId')
            ->orderByDesc('cnt')
            ->limit(5)
            ->get();
        $categoryNames = ClassifiedCategory::whereIn('id', $topCategoryRows->pluck('categoryId'))->pluck('name', 'id');

        return ApiResponse::ok([
            'listings' => [
                'total' => ClassifiedListing::count(),
                'byStatus' => collect(self::STATUSES)->mapWithKeys(fn ($s) => [$s => (int) ($byStatus[$s] ?? 0)]),
                'postedToday' => ClassifiedListing::where('createdAt', '>=', $today)->count(),
                'postedThisWeek' => ClassifiedListing::where('createdAt', '>=', $weekAgo)->count(),
                'postedThisMonth' => ClassifiedListing::where('createdAt', '>=', $monthAgo)->count(),
                'totalViews' => (int) ClassifiedListing::sum('viewCount'),
                'totalFavorites' => (int) ClassifiedListing::sum('favoriteCount'),
                'topCategories' => $topCategoryRows->map(fn ($row) => [
                    'categoryId' => $row->categoryId,
                    'name' => $categoryNames[$row->categoryId] ?? 'Uncategorized',
                    'count' => (int) $row->cnt,
                ])->values(),
            ],
            'sellers' => [
                'totalWithListings' => ClassifiedListing::distinct('sellerId')->count('sellerId'),
                'activeSellers' => ClassifiedListing::where('status', 'ACTIVE')->distinct('sellerId')->count('sellerId'),
            ],
            'messaging' => [
                'totalConversations' => ClassifiedConversation::count(),
                'totalMessages' => ClassifiedMessage::count(),
                'messagesToday' => ClassifiedMessage::where('createdAt', '>=', $today)->count(),
            ],
            'follows' => [
                'total' => ClassifiedFollow::count(),
            ],
            'reports' => [
                'pending' => ClassifiedReport::where('status', 'PENDING')->count(),
                'reviewed' => ClassifiedReport::where('status', 'REVIEWED')->count(),
                'dismissed' => ClassifiedReport::where('status', 'DISMISSED')->count(),
                'today' => ClassifiedReport::where('createdAt', '>=', $today)->count(),
            ],
        ]);
    }
}
