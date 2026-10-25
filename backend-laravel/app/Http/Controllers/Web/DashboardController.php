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
use App\Http\Controllers\SiteController;
use App\Http\Controllers\UserController;
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
    ];

    // WhatsApp broadcasts and Poster Studio are not part of the Laravel
    // backend yet (see README), so the manager doesn't offer them.
    public const SECTIONS = ['Details', 'Hours', 'Services', 'Photos', 'Reviews & QR', 'Website', 'Products', 'Orders', 'Customers'];

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
        $visibleTabs = array_keys(array_filter(self::TABS, fn ($t) => $this->can($t['privilege'])));
        $tab = in_array($request->query('tab'), $visibleTabs, true) ? $request->query('tab') : ($visibleTabs[0] ?? null);

        $bizPage = max(1, (int) $request->query('page', 1));
        $mine = InternalApi::call([BusinessController::class, 'mine'], ['page' => $tab === 'businesses' ? $bizPage : 1], [], true);
        $businesses = $mine['data'];

        $ratedReviews = array_sum(array_column($businesses, 'reviewCount'));
        $weighted = array_sum(array_map(fn ($b) => $b['avgRating'] * $b['reviewCount'], $businesses));
        $stats = [
            'listings' => count($businesses),
            'totalViews' => array_sum(array_map(fn ($b) => $b['viewCount'] ?? 0, $businesses)),
            'totalLeads' => array_sum(array_map(fn ($b) => $b['leadCount'] ?? 0, $businesses)),
            'ratedReviews' => $ratedReviews,
            'avgRating' => $ratedReviews > 0 ? $weighted / $ratedReviews : 0,
        ];

        $points = $isDealer ? (InternalApi::tryCall([PointsController::class, 'mine'], [], [], true)['data'] ?? null) : null;
        $accounts = null;
        if ($isDealer && $tab === 'businesses') {
            $accounts = InternalApi::tryCall([UserController::class, 'listCreated'], ['page' => max(1, (int) $request->query('accountsPage', 1))], [], true);
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

        $section = in_array($request->query('section'), self::SECTIONS, true) ? $request->query('section') : 'Details';
        $page = max(1, (int) $request->query('page', 1));
        $data = [];

        // Each section loads only what it shows.
        switch ($section) {
            case 'Details':
                $data['categories'] = InternalApi::tryCall([CategoryController::class, 'index'])['data'] ?? [];
                break;
            case 'Reviews & QR':
                $data['links'] = InternalApi::tryCall([ReviewLinkController::class, 'show'], [], ['id' => $id], true)['data'] ?? null;
                $data['boards'] = InternalApi::tryCall([QrCodeController::class, 'businessQrCodes'], [], ['id' => $id], true)['data'] ?? [];
                break;
            case 'Website':
                $data['site'] = InternalApi::tryCall([SiteController::class, 'show'], [], ['id' => $id], true)['data'] ?? null;
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
