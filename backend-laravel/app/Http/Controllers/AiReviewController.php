<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Support\AiReview;
use App\Support\ApiResponse;
use App\Support\BusinessAccess;
use App\Support\BusinessFeatures;
use App\Support\ReviewChannels;
use Illuminate\Http\Request;

// AI Google Review (App\Support\AiReview): the business's settings and
// stats for the people who manage it, and — with no sign-in — the review
// the public /review/<slug> page asks the AI to write for a customer.
class AiReviewController extends Controller
{
    private function managed(Request $request, string $id): Business
    {
        $business = Business::find($id);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        BusinessAccess::assertCanManage($request->attributes->get('auth'), $business);
        BusinessFeatures::assert($business, BusinessFeatures::AI_REVIEW);

        return $business;
    }

    private function present(Business $business)
    {
        return ApiResponse::ok([
            ...AiReview::settings($business),
            'url' => AiReview::url($business),
            'googleReviewUrl' => ReviewChannels::google($business),
            'live' => AiReview::live($business),
            'published' => $business->status === 'PUBLISHED',
            'views' => (int) $business->aiReviewViews,
            'copies' => (int) $business->aiReviewCopies,
            'languageOptions' => collect(AiReview::LANGUAGES)->map(fn ($l, $code) => ['code' => $code, 'name' => $l[0], 'native' => $l[1]])->values(),
            'toneOptions' => collect(AiReview::TONES)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            'lengthOptions' => collect(AiReview::LENGTHS)->map(fn ($l, $key) => ['key' => $key, 'label' => $l[0]])->values(),
            'themeOptions' => collect(AiReview::THEMES)->map(fn ($t, $key) => ['key' => $key, 'label' => $t[0], 'brand' => $t[1]])->values(),
            // Reviews remembered so new ones read differently.
            'remembered' => AiReview::draftCount($business),
        ]);
    }

    public function show(Request $request, string $id)
    {
        return $this->present($this->managed($request, $id));
    }

    public function update(Request $request, string $id)
    {
        $business = $this->managed($request, $id);
        $data = $request->validate(AiReview::rules());
        $business->update(['aiReview' => [...AiReview::settings($business), ...array_map(fn ($v) => $v ?? '', $data)]]);

        return $this->present($business->fresh());
    }

    // "Try it" in the dashboard: a review as a customer would get one, before the page is live too.
    public function sample(Request $request, string $id)
    {
        $business = $this->managed($request, $id);
        $data = $request->validate(['rating' => ['required', 'integer', 'min:1', 'max:5'], 'language' => ['required', 'string']]);

        // A try-out isn't a customer's review, so it isn't remembered.
        return ApiResponse::ok(AiReview::write($business, (int) $data['rating'], $data['language'], false));
    }

    private function live(string $slug): Business
    {
        $business = Business::where('slug', $slug)->first();
        if (! $business || ! AiReview::live($business)) {
            throw ApiException::notFound('This review page is not available');
        }

        return $business;
    }

    // The public page: a fresh review each time it's asked.
    public function generate(Request $request, string $slug)
    {
        $business = $this->live($slug);
        $data = $request->validate(['rating' => ['required', 'integer', 'min:1', 'max:5'], 'language' => ['required', 'string']]);

        return ApiResponse::ok(AiReview::write($business, (int) $data['rating'], $data['language']));
    }

    // Counts a review copied on the public page (the owner's "copied" stat).
    public function copied(string $slug)
    {
        $business = $this->live($slug);
        Business::whereKey($business->id)->increment('aiReviewCopies');

        return ApiResponse::ok(['copied' => true]);
    }
}
