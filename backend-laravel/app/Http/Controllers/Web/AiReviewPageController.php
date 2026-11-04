<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Support\AiReview;
use App\Support\Cards\CardEngine;
use App\Support\ReviewChannels;

// The public AI Google Review page at /review/<slug> (App\Support\AiReview):
// what the business's review QR code or shared link opens.
class AiReviewPageController extends Controller
{
    public function __invoke(string $slug)
    {
        $business = Business::with('category')->where('slug', $slug)->first();
        abort_unless($business && AiReview::live($business), 404);
        Business::whereKey($business->id)->increment('aiReviewViews');

        $settings = AiReview::settings($business);

        return response()->view('ai-review.page', [
            'b' => CardEngine::details($business),
            'slug' => $business->slug,
            'googleUrl' => ReviewChannels::google($business),
            'languages' => collect($settings['languages'])->map(fn ($code) => ['code' => $code, 'label' => AiReview::LANGUAGES[$code][1]])->all(),
        ])->header('Cache-Control', 'no-store');
    }
}
