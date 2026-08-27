<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\Review;
use App\Support\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    private function recalculateRating(string $businessId): void
    {
        $agg = Review::where('businessId', $businessId)->selectRaw('AVG(rating) as avg_rating, COUNT(rating) as cnt')->first();
        Business::where('id', $businessId)->update([
            'avgRating' => $agg->avg_rating ? round($agg->avg_rating, 1) : 0,
            'reviewCount' => (int) $agg->cnt,
        ]);
    }

    public function store(Request $request, string $businessId)
    {
        $actor = $request->attributes->get('auth');
        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:150'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        if (! Business::find($businessId)) {
            throw ApiException::notFound('Business not found');
        }

        if (Review::where('businessId', $businessId)->where('userId', $actor['sub'])->exists()) {
            throw ApiException::conflict('You have already reviewed this business');
        }

        $review = Review::create([...$data, 'businessId' => $businessId, 'userId' => $actor['sub']]);
        $this->recalculateRating($businessId);

        return ApiResponse::created($review);
    }

    public function index(Request $request, string $businessId)
    {
        $pagination = Pagination::parse($request->query());
        $query = Review::where('businessId', $businessId);
        $total = (clone $query)->count();
        $items = $query->orderByDesc('createdAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with('user:id,firstName,lastName,avatarUrl')
            ->get();

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    public function reply(Request $request, string $reviewId)
    {
        $actor = $request->attributes->get('auth');
        $data = $request->validate(['ownerReply' => ['required', 'string', 'min:1', 'max:1000']]);

        $review = Review::with('business')->find($reviewId);
        if (! $review) {
            throw ApiException::notFound('Review not found');
        }
        if ($review->business->ownerId !== $actor['sub']) {
            throw ApiException::forbidden('You do not own this business');
        }

        $review->update(['ownerReply' => $data['ownerReply'], 'ownerRepliedAt' => now()]);

        return ApiResponse::ok($review);
    }

    public function destroy(Request $request, string $reviewId)
    {
        $actor = $request->attributes->get('auth');
        $review = Review::find($reviewId);
        if (! $review) {
            throw ApiException::notFound('Review not found');
        }
        if ($review->userId !== $actor['sub'] && $actor['role'] !== 'ADMIN') {
            throw ApiException::forbidden();
        }

        $businessId = $review->businessId;
        $review->delete();
        $this->recalculateRating($businessId);

        return ApiResponse::noContent();
    }
}
