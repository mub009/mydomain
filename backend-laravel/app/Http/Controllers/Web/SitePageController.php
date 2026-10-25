<?php

namespace App\Http\Controllers\Web;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Controllers\SiteController;
use App\Http\Controllers\StorefrontController;
use App\Support\InternalApi;

// A business's own published website, rendered standalone — no Markkito
// header, footer or page container — so its full-width hero, map and
// sticky nav behave the way they do on a normal site.
class SitePageController extends Controller
{
    public const STOREFRONT_PAGE_SIZE = 12;

    public function __invoke(string $slug)
    {
        try {
            $site = InternalApi::call([SiteController::class, 'published'], [], ['slug' => $slug])['data'];
        } catch (ApiException $e) {
            return response()->view('pages.site-unavailable', ['slug' => $slug, 'message' => $e->getMessage()], 404);
        }

        if ($site['siteType'] === 'ECOMMERCE') {
            // Storefronts are rendered by the app rather than served as
            // authored markup — published builder pages have their scripts
            // stripped, so a cart could not run there.
            $products = InternalApi::tryCall([StorefrontController::class, 'publicProducts'], ['page' => 1, 'pageSize' => self::STOREFRONT_PAGE_SIZE], ['slug' => $slug]);

            return view('pages.storefront', [
                'site' => $site,
                'products' => $products['data'] ?? [],
                'total' => $products['meta']['total'] ?? 0,
            ]);
        }

        return view('pages.site', ['site' => $site]);
    }
}
