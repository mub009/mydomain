<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\ReviewScan;
use App\Support\ApiResponse;
use App\Support\BusinessAccess;
use App\Support\GooglePlaceLink;
use App\Support\GooglePlaces;
use App\Support\ReviewChannels;
use App\Support\SocialLinks;
use Illuminate\Http\Request;

class ReviewLinkController extends Controller
{
    private function assertOwnerOrAdmin(array $actor, Business $business): void
    {
        BusinessAccess::assertCanManage($actor, $business);
    }

    private function present(array $actor, Business $business)
    {
        $this->assertOwnerOrAdmin($actor, $business);

        $scans = ReviewScan::where('businessId', $business->id)
            ->selectRaw('channel, COUNT(*) as cnt')->groupBy('channel')->pluck('cnt', 'channel');

        return ApiResponse::ok([
            'slug' => $business->slug,
            'googlePlaceId' => $business->googlePlaceId,
            'googleReviewUrl' => $business->googleReviewUrl,
            'instagramUsername' => $business->instagramUsername,
            'facebookPageUrl' => $business->facebookPageUrl,
            'youtubeUrl' => $business->youtubeUrl,
            // TikTok, X, LinkedIn, ... as the owner typed them (SocialLinks).
            ...SocialLinks::fields($business),
            'website' => $business->website,
            'preferredReviewChannel' => $business->preferredReviewChannel,
            // Whether "Find my business on Google" can be offered (GooglePlaces).
            'placesSearch' => GooglePlaces::configured(),
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

    // "Find my business on Google": matches for the listing's name and city
    // (or what the owner typed), nearest the shop first, to pick one from.
    public function searchPlaces(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = Business::find($id);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        $this->assertOwnerOrAdmin($actor, $business);
        $data = $request->validate(['q' => ['sometimes', 'nullable', 'string', 'max:200']]);
        $query = trim((string) ($data['q'] ?? '')) ?: trim("{$business->name} {$business->city}");

        return ApiResponse::ok([
            'query' => $query,
            'places' => GooglePlaces::search($query, $business->latitude, $business->longitude),
        ]);
    }

    public function update(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = Business::find($id);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        $this->assertOwnerOrAdmin($actor, $business);

        $data = $request->validate([
            'googlePlaceId' => ['sometimes', 'nullable', 'string', 'max:255'],
            'googleReviewUrl' => ['sometimes', 'nullable', 'url', 'max:500'],
            'instagramUsername' => ['sometimes', 'nullable', 'string', 'max:100'],
            'facebookPageUrl' => ['sometimes', 'nullable', 'string', 'max:500'],
            'youtubeUrl' => ['sometimes', 'nullable', 'string', 'max:500'],
            'preferredReviewChannel' => ['sometimes', 'nullable', 'in:'.implode(',', ReviewChannels::ALL)],
            ...SocialLinks::rules(),
        ]);
        // The other social profiles live together in one column.
        $social = SocialLinks::merge($business, $data);
        $data = array_diff_key($data, SocialLinks::rules());

        // A link pasted into the Place ID box: find the place in it.
        if (! empty($data['googlePlaceId']) && str_contains($data['googlePlaceId'], '/')) {
            $data['googlePlaceId'] = GooglePlaceLink::placeId($data['googlePlaceId'])
                ?? throw ApiException::badRequest('We couldn’t find your place in that link. Paste the Share link from Google Maps (maps.app.goo.gl/…), or the Place ID itself (it starts with ChIJ).');
        }
        // A Google Maps share link (the easy one to copy) in the review link box: find the
        // place, so customers land straight on Google's review box. A link we can't
        // read is kept as it is: it still opens the business on Google.
        $reviewUrl = $data['googleReviewUrl'] ?? null;
        if ($reviewUrl && ! GooglePlaceLink::isDirectReviewLink($reviewUrl) && GooglePlaceLink::looksLikeGoogleLink($reviewUrl)
            && ($placeId = GooglePlaceLink::placeId($reviewUrl))) {
            $data['googlePlaceId'] = $placeId;
            $data['googleReviewUrl'] = null;
        }

        // A preferred channel is only meaningful if that channel is configured.
        $merged = array_merge($business->only([
            'googlePlaceId', 'googleReviewUrl', 'instagramUsername', 'facebookPageUrl', 'youtubeUrl',
            'website', 'latitude', 'longitude', 'slug',
        ]), $data);
        if (! empty($data['preferredReviewChannel']) && ! ReviewChannels::resolve($merged, $data['preferredReviewChannel'])) {
            $label = strtolower($data['preferredReviewChannel']);
            throw ApiException::badRequest("Add your {$label} details before making it the default review channel");
        }

        $business->update([...$data, 'socialLinks' => $social ?: null]);

        return $this->present($actor, $business);
    }
}
