<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\ReviewScan;
use App\Support\ApiResponse;
use App\Support\ReviewChannels;
use Illuminate\Http\Request;

class ReviewLinkController extends Controller
{
    private function assertOwnerOrAdmin(array $actor, string $ownerId): void
    {
        if ($actor['role'] === 'ADMIN') {
            return;
        }
        if ($actor['sub'] !== $ownerId) {
            throw ApiException::forbidden('You do not own this business');
        }
    }

    private function present(array $actor, Business $business)
    {
        $this->assertOwnerOrAdmin($actor, $business->ownerId);

        $scans = ReviewScan::where('businessId', $business->id)
            ->selectRaw('channel, COUNT(*) as cnt')->groupBy('channel')->pluck('cnt', 'channel');

        return ApiResponse::ok([
            'slug' => $business->slug,
            'googlePlaceId' => $business->googlePlaceId,
            'googleReviewUrl' => $business->googleReviewUrl,
            'instagramUsername' => $business->instagramUsername,
            'facebookPageUrl' => $business->facebookPageUrl,
            'youtubeUrl' => $business->youtubeUrl,
            'website' => $business->website,
            'preferredReviewChannel' => $business->preferredReviewChannel,
            'resolved' => [
                'GOOGLE' => ReviewChannels::google($business),
                'INSTAGRAM' => ReviewChannels::instagram($business),
                'FACEBOOK' => ReviewChannels::facebook($business),
                'YOUTUBE' => ReviewChannels::youtube($business),
                'WEBSITE' => ReviewChannels::website($business),
                'DIRECTIONS' => ReviewChannels::directions($business),
                'MARKKITO' => ReviewChannels::markkito($business),
                'MARKKITO_REVIEW' => ReviewChannels::markkitoReview($business),
            ],
            'scanCounts' => (object) $scans->map(fn ($v) => (int) $v)->toArray(),
            'totalScans' => (int) $scans->sum(),
        ]);
    }

    public function show(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = Business::find($id);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }

        return $this->present($actor, $business);
    }

    public function update(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = Business::find($id);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        $this->assertOwnerOrAdmin($actor, $business->ownerId);

        $data = $request->validate([
            'googlePlaceId' => ['sometimes', 'nullable', 'string', 'max:255'],
            'googleReviewUrl' => ['sometimes', 'nullable', 'url', 'max:500'],
            'instagramUsername' => ['sometimes', 'nullable', 'string', 'max:100'],
            'facebookPageUrl' => ['sometimes', 'nullable', 'string', 'max:500'],
            'youtubeUrl' => ['sometimes', 'nullable', 'string', 'max:500'],
            'preferredReviewChannel' => ['sometimes', 'nullable', 'in:'.implode(',', ReviewChannels::ALL)],
        ]);

        // A preferred channel is only meaningful if that channel is configured.
        $merged = array_merge($business->only([
            'googlePlaceId', 'googleReviewUrl', 'instagramUsername', 'facebookPageUrl', 'youtubeUrl',
            'website', 'latitude', 'longitude', 'slug',
        ]), $data);
        if (! empty($data['preferredReviewChannel']) && ! ReviewChannels::resolve($merged, $data['preferredReviewChannel'])) {
            $label = strtolower($data['preferredReviewChannel']);
            throw ApiException::badRequest("Add your {$label} details before making it the default review channel");
        }

        $business->update($data);

        return $this->present($actor, $business);
    }
}
