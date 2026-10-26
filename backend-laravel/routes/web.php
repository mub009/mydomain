<?php

use App\Http\Controllers\QrCodeController;
use App\Http\Controllers\Web\AdminPageController;
use App\Http\Controllers\Web\AuthPageController;
use App\Http\Controllers\Web\BusinessPageController;
use App\Http\Controllers\Web\DashboardController;
use App\Http\Controllers\Web\GoldRatePageController;
use App\Http\Controllers\Web\HomeController;
use App\Http\Controllers\Web\SearchPageController;
use App\Http\Controllers\Web\SitePageController;
use App\Http\Controllers\Web\SitemapController;
use App\Support\SiteUrl;
use Illuminate\Support\Facades\Route;

// A business's own website on its subdomain (config/sites.php). Registered
// first so <slug>.<domain>/ is the website rather than the Markkito home
// page; everything else on a subdomain (assets, the API) works as usual.
if ($siteDomain = config('sites.domain')) {
    Route::domain('{slug}.'.$siteDomain)->where(['slug' => SiteUrl::slugPattern()])->group(function () {
        Route::get('/', SitePageController::class);
    });
}

Route::get('/health', function () {
    return response()->json(['status' => 'ok', 'timestamp' => now()->toIso8601String()]);
});

// For search engines: every live listing and website, and where to find them.
Route::get('/sitemap.xml', [SitemapController::class, 'index']);
Route::get('/sitemap-{n}.xml', [SitemapController::class, 'page'])->whereNumber('n');
Route::get('/robots.txt', [SitemapController::class, 'robots']);

// Short public path encoded on a printed QR board: /r/q/<code>
Route::get('/r/q/{code}', [QrCodeController::class, 'scan']);

// The site's pages are server-rendered Blade (resources/views/pages), with
// small plain-JS modules (resources/js/pages) for the interactive parts.
Route::get('/', HomeController::class);
Route::get('/search', SearchPageController::class);
// B2B is the same directory as B2C, just pre-filtered — a business picks
// B2B/B2C at registration, not a separate marketplace.
Route::redirect('/b2b', '/search?businessType=B2B');
Route::get('/business/{slug}', BusinessPageController::class);
// The same website at a path on the main domain. It keeps working alongside
// the subdomain, which the page names as its canonical address.
Route::get('/site/{slug}', SitePageController::class);
// Landing point for a scanned (or hand-typed) pre-printed QR board.
Route::get('/qr/{code?}', fn (\Illuminate\Http\Request $request, ?string $code = null) => view('pages.qr-claim', [
    'code' => $code ? strtoupper($code) : '',
    'unknown' => $request->boolean('unknown'),
]));

Route::middleware('web.role:BUSINESS_OWNER,DEALER,ADMIN')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/dashboard/businesses/{id}', [DashboardController::class, 'manage']);
});

Route::middleware('web.role:ADMIN')->group(function () {
    Route::get('/admin', AdminPageController::class);
    Route::get('/admin/online', [AdminPageController::class, 'online']);
    // The gold-rate template editor, and the stored images it draws on —
    // kept off public URLs, so they're served here to admins only.
    Route::get('/admin/gold-rates/templates/{id}', [GoldRatePageController::class, 'editor']);
    Route::get('/admin/gold-rates/templates/{id}/image', [GoldRatePageController::class, 'templateImage']);
    Route::get('/admin/gold-rates/templates/{id}/thumb', [GoldRatePageController::class, 'templateThumb']);
    Route::get('/admin/gold-rates/logos/{id}/image', [GoldRatePageController::class, 'logoImage']);
    Route::get('/admin/gold-rates/businesses/{id}/logo', [GoldRatePageController::class, 'businessLogo']);
});

Route::get('/login', [AuthPageController::class, 'showLogin']);
Route::post('/login', [AuthPageController::class, 'login'])->middleware('throttle:20,15');
Route::get('/register', [AuthPageController::class, 'showRegister']);
Route::post('/register', [AuthPageController::class, 'register'])->middleware('throttle:20,15');
Route::post('/logout', [AuthPageController::class, 'logout']);
// A short-lived API token for the signed-in session; see resources/js/lib/api.js.
Route::get('/session/token', [AuthPageController::class, 'token']);
