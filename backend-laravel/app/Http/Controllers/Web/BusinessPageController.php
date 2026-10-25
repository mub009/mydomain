<?php

namespace App\Http\Controllers\Web;

use App\Exceptions\ApiException;
use App\Http\Controllers\BusinessController;
use App\Http\Controllers\Controller;
use App\Http\Controllers\ReviewController;
use App\Support\InternalApi;
use Illuminate\Http\Request;

class BusinessPageController extends Controller
{
    public const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    public const TABS = ['Overview', 'Photos', 'Services', 'Reviews'];

    public function __invoke(Request $request, string $slug)
    {
        try {
            $business = InternalApi::call([BusinessController::class, 'show'], [], ['slug' => $slug])['data'];
        } catch (ApiException) {
            abort(404);
        }

        // A "Markkito review" QR board lands here with ?review=1, so open
        // straight on the review composer rather than the overview.
        $wantsReview = $request->query('review') === '1';
        $tab = in_array($request->query('tab'), self::TABS, true) ? $request->query('tab') : ($wantsReview ? 'Reviews' : 'Overview');

        // Reviews are paginated separately — the business payload only
        // embeds the latest few for the summary strip.
        $reviewPage = max(1, (int) $request->query('page', 1));
        $reviews = InternalApi::tryCall([ReviewController::class, 'index'], ['page' => $reviewPage], ['businessId' => $business['id']]);

        $address = implode(', ', array_filter([
            $business['addressLine1'] ?? null, $business['addressLine2'] ?? null, $business['city'] ?? null,
            $business['state'] ?? null, $business['postalCode'] ?? null, $business['country'] ?? null,
        ]));

        return view('pages.business', [
            'biz' => $business,
            'tab' => $tab,
            'wantsReview' => $wantsReview,
            'reviews' => $reviews['data'] ?? $business['reviews'] ?? [],
            'reviewMeta' => $reviews['meta'] ?? ['page' => 1, 'totalPages' => 1, 'total' => 0],
            'address' => $address,
            // Recent rating trend: newest first, capped at 9.
            'ratingTrend' => array_map(fn ($r) => (float) $r['rating'], array_slice($business['reviews'] ?? [], 0, 9)),
        ]);
    }
}
