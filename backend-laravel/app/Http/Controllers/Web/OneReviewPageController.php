<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Support\Cards\CardEngine;
use App\Support\OneReview;

// The public One Review page at /one/<slug> (App\Support\OneReview): what the
// business's One Review QR code opens — all its review and social links.
class OneReviewPageController extends Controller
{
    public function __invoke(string $slug)
    {
        $business = Business::with('category')->where('slug', $slug)->first();
        abort_unless($business && OneReview::live($business), 404);
        Business::whereKey($business->id)->increment('oneReviewViews');

        return response()->view('one-review.page', [
            'b' => CardEngine::details($business),
            'slug' => $business->slug,
            'rating' => $business->reviewCount > 0 ? ['avg' => round((float) $business->avgRating, 1), 'count' => (int) $business->reviewCount] : null,
            'links' => OneReview::active($business),
        ])->header('Cache-Control', 'no-store');
    }
}
