<?php

namespace App\Http\Controllers\Web;

use App\Exceptions\ApiException;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\BusinessController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\Controller;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PointsController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\QrCodeController;
use App\Http\Controllers\ReviewLinkController;
use App\Http\Controllers\SeoController;
use App\Http\Controllers\SiteController;
use App\Http\Controllers\UserController;
use App\Models\Business;
use App\Support\InternalApi;
use App\Support\Privileges;
use App\Support\WebAuth;
use Illuminate\Http\Request;

// The business owner / dealer dashboard. Lists and forms are rendered here;
// the page scripts save changes through the /api/v1 endpoints.
class DashboardController extends Controller
{
    public const TABS = [
        'businesses' => ['label' => 'Businesses', 'icon' => 'layout-grid', 'privilege' => 'MANAGE_LISTINGS'],
        'leads' => ['label' => 'Leads', 'icon' => 'message-square', 'privilege' => 'MANAGE_LEADS'],
        'bookings' => ['label' => 'Bookings', 'icon' => 'calendar-clock', 'privilege' => 'MANAGE_BOOKINGS'],
        // The accounts a dealer created for business teams (dealers only).
        'logins' => ['label' => 'Business logins', 'icon' => 'key-round', 'privilege' => 'MANAGE_LISTINGS', 'dealerOnly' => true],
    ];

    public const LOGINS_PAGE_SIZE = 20;

    // WhatsApp broadcasts and Poster Studio are not part of the Laravel
    // backend yet (see README), so the manager doesn't offer them.
    public const SECTIONS = ['Contact', 'Hours', 'Services', 'Photos', 'Slider', 'Our Gallery', 'Reviews & QR', 'Website', 'SEO', 'Products', 'Orders', 'Customers'];

    // How each section appears on the business's menu page: its icon, the
    // icon's colours, and one line on what it is for.
    public const SECTION_TILES = [
        'Contact' => ['icon' => 'phone', 'tint' => 'bg-blue-50 text-blue-600', 'blurb' => 'Name, category, contact details and address'],
        'Hours' => ['icon' => 'clock', 'tint' => 'bg-amber-50 text-amber-600', 'blurb' => 'Opening and closing times for each day'],
        'Services' => ['icon' => 'wrench', 'tint' => 'bg-violet-50 text-violet-600', 'blurb' => 'What you offer, with prices'],
        'Photos' => ['icon' => 'image-plus', 'tint' => 'bg-pink-50 text-pink-600', 'blurb' => 'Photos on your listing page'],
        'Slider' => ['icon' => 'play', 'tint' => 'bg-orange-50 text-orange-600', 'blurb' => 'Banner photos that slide on your website'],
        'Our Gallery' => ['icon' => 'layout-grid', 'tint' => 'bg-teal-50 text-teal-600', 'blurb' => 'The gallery section of your website'],
        'Reviews & QR' => ['icon' => 'qr-code', 'tint' => 'bg-yellow-50 text-yellow-600', 'blurb' => 'Review links and QR boards'],
        'Website' => ['icon' => 'globe', 'tint' => 'bg-sky-50 text-sky-600', 'blurb' => 'Design and publish your website'],
        'SEO' => ['icon' => 'search-check', 'tint' => 'bg-lime-50 text-lime-700', 'blurb' => 'How you appear on Google, and whether you are listed'],
        'Products' => ['icon' => 'package', 'tint' => 'bg-emerald-50 text-emerald-600', 'blurb' => 'Items for your online shop'],
        'Orders' => ['icon' => 'receipt', 'tint' => 'bg-indigo-50 text-indigo-600', 'blurb' => 'Orders placed in your shop'],
        'Customers' => ['icon' => 'users', 'tint' => 'bg-rose-50 text-rose-600', 'blurb' => 'People who have ordered from you'],
    ];

    public const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];

    public const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

    private function can(string $privilege): bool
    {
        $user = WebAuth::user();

        return Privileges::has($user->role, $user->privileges, $privilege);
    }

    public function index(Request $request)
    {
        $user = WebAuth::user();
        $isDealer = $user->role === 'DEALER';

        // Dealers are gated by their granted privileges; business owners and
        // admins implicitly hold every privilege on their own resources.
        $visibleTabs = array_keys(array_filter(self::TABS, fn ($t) => $this->can($t['privilege']) && ($isDealer || empty($t['dealerOnly']))));
        $tab = in_array($request->query('tab'), $visibleTabs, true) ? $request->query('tab') : ($visibleTabs[0] ?? null);

        $bizPage = max(1, (int) $request->query('page', 1));
        $search = in_array($tab, ['businesses', 'logins'], true) ? trim((string) $request->query('search')) : '';
        $mine = InternalApi::call([BusinessController::class, 'mine'], array_filter([
            'page' => $tab === 'businesses' ? $bizPage : 1,
            'search' => $tab === 'businesses' ? $search : '',
        ]), [], true);
        $businesses = $mine['data'];

        // Totals across every listing the user manages, not just this page.
        $scope = $isDealer
            ? Business::where(fn ($q) => $q->where('ownerId', $user->id)->orWhere('createdById', $user->id))
            : Business::where('ownerId', $user->id);
        $totals = $scope->selectRaw(
            "count(*) as listings, sum(case when status = 'PUBLISHED' then 1 else 0 end) as live,"
            .' coalesce(sum(viewCount), 0) as views, coalesce(sum(leadCount), 0) as leads,'
            .' coalesce(sum(reviewCount), 0) as reviews, coalesce(sum(avgRating * reviewCount), 0) as weighted'
        )->first();
        $stats = [
            'listings' => (int) $totals->listings,
            'live' => (int) $totals->live,
            'totalViews' => (int) $totals->views,
            'totalLeads' => (int) $totals->leads,
            'ratedReviews' => (int) $totals->reviews,
            'avgRating' => $totals->reviews > 0 ? $totals->weighted / $totals->reviews : 0,
        ];

        $points = $isDealer ? (InternalApi::tryCall([PointsController::class, 'mine'], [], [], true)['data'] ?? null) : null;
        $accounts = null;
        if ($tab === 'logins') {
            $accounts = InternalApi::tryCall([UserController::class, 'listCreated'], array_filter([
                'page' => $bizPage, 'pageSize' => self::LOGINS_PAGE_SIZE, 'search' => $search,
            ]), [], true);
        }

        // Leads and bookings are per business, chosen from a dropdown.
        $selectedId = $request->query('business');
        if (! collect($businesses)->contains('id', $selectedId)) {
            $selectedId = $businesses[0]['id'] ?? null;
        }
        $list = null;
        if ($selectedId && in_array($tab, ['leads', 'bookings'], true)) {
            $action = $tab === 'leads' ? [LeadController::class, 'index'] : [BookingController::class, 'forBusiness'];
            $list = InternalApi::tryCall($action, ['page' => $bizPage], ['businessId' => $selectedId], true);
        }

        return view('pages.dashboard.index', [
            'user' => $user,
            'isDealer' => $isDealer,
            'canAssignOwner' => $isDealer || $user->role === 'ADMIN',
            'visibleTabs' => $visibleTabs,
            'tab' => $tab,
            'businesses' => $businesses,
            'bizMeta' => $mine['meta'],
            'search' => $search,
            'stats' => $stats,
            'points' => $points,
            'outOfPoints' => $isDealer && $points !== null && $points['points'] <= 0,
            'accounts' => $accounts,
            'categories' => InternalApi::tryCall([CategoryController::class, 'index'])['data'] ?? [],
            'selectedId' => $selectedId,
            'list' => $list,
        ]);
    }

    public function manage(Request $request, string $id)
    {
        if (! $this->can('MANAGE_LISTINGS')) {
            return redirect('/dashboard');
        }

        try {
            $biz = InternalApi::call([BusinessController::class, 'manage'], [], ['id' => $id], true)['data'];
        } catch (ApiException $e) {
            abort($e->statusCode === 403 ? 403 : 404);
        }

        // With no section picked, the page is the menu of all of them.
        $section = in_array($request->query('section'), self::SECTIONS, true) ? $request->query('section') : null;
        $page = max(1, (int) $request->query('page', 1));
        $data = [];

        // Each section loads only what it shows.
        switch ($section) {
            case 'Contact':
                $data['categories'] = InternalApi::tryCall([CategoryController::class, 'index'])['data'] ?? [];
                break;
            case 'Reviews & QR':
                $data['links'] = InternalApi::tryCall([ReviewLinkController::class, 'show'], [], ['id' => $id], true)['data'] ?? null;
                $data['boards'] = InternalApi::tryCall([QrCodeController::class, 'businessQrCodes'], [], ['id' => $id], true)['data'] ?? [];
                break;
            case 'Slider':
            case 'Our Gallery':
                $kind = $section === 'Slider' ? 'slider' : 'gallery';
                $data['imageSet'] = ['kind' => $kind, ...InternalApi::tryCall([SiteController::class, 'images'], [], ['id' => $id, 'kind' => $kind], true)['data'] ?? []];
                break;
            case 'Website':
                $data['site'] = InternalApi::tryCall([SiteController::class, 'show'], [], ['id' => $id], true)['data'] ?? null;
                break;
            case 'SEO':
                $data['seo'] = InternalApi::tryCall([SeoController::class, 'forBusiness'], [], ['id' => $id], true)['data'] ?? null;
                break;
            case 'Products':
                $data['products'] = InternalApi::tryCall([ProductController::class, 'index'], array_filter([
                    'page' => $page, 'pageSize' => 10, 'search' => $request->query('search'),
                ]), ['businessId' => $id], true);
                break;
            case 'Orders':
                $data['orders'] = InternalApi::tryCall([OrderController::class, 'index'], array_filter([
                    'page' => $page, 'pageSize' => 10, 'status' => $request->query('status'), 'search' => $request->query('search'),
                ]), ['businessId' => $id], true);
                break;
            case 'Customers':
                $data['customers'] = InternalApi::tryCall([OrderController::class, 'customers'], array_filter([
                    'page' => $page, 'pageSize' => 20, 'search' => $request->query('search'),
                ]), ['businessId' => $id], true);
                break;
        }

        return view('pages.dashboard.manage', [
            'biz' => $biz,
            'section' => $section,
            ...$data,
        ]);
    }

    // A small closure-free helper for the views: the dashboard URL with
    // some query values changed.
    public static function url(array $patch, string $path = '/dashboard'): string
    {
        $query = array_filter(array_merge(request()->query(), $patch), fn ($v) => $v !== null && $v !== '');
        $qs = http_build_query($query);

        return $path.($qs ? "?{$qs}" : '');
    }
}
