<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Support\ApiResponse;
use App\Support\BusinessAccess;
use App\Support\BusinessFeatures;
use App\Support\OneReview;
use Illuminate\Http\Request;

// One Review (App\Support\OneReview): the page's link, links and stats for
// the people who manage the business, and — with no sign-in — counting a
// link tapped on the public /one/<slug> page.
class OneReviewController extends Controller
{
    public function show(Request $request, string $id)
    {
        $business = Business::find($id);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        BusinessAccess::assertCanManage($request->attributes->get('auth'), $business);
        BusinessFeatures::assert($business, BusinessFeatures::ONE_REVIEW);

        return ApiResponse::ok([
            'url' => OneReview::url($business),
            'live' => OneReview::live($business),
            'published' => $business->status === 'PUBLISHED',
            'views' => (int) $business->oneReviewViews,
            'links' => OneReview::links($business),
        ]);
    }

    public function tap(Request $request, string $slug)
    {
        $business = Business::where('slug', $slug)->first();
        if (! $business || ! OneReview::live($business)) {
            throw ApiException::notFound('Page not found');
        }
        $key = (string) $request->input('link');
        if (! array_key_exists($key, OneReview::LINKS)) {
            throw ApiException::badRequest('Unknown link');
        }
        OneReview::countTap($business, $key);

        return ApiResponse::ok(['counted' => true]);
    }
}
