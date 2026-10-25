<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\Controller;
use App\Http\Controllers\QrCodeController;
use App\Http\Controllers\SeoController;
use App\Http\Controllers\VisitorController;
use App\Support\InternalApi;
use Illuminate\Http\Request;

// The admin console. Each tab is its own server-rendered view of one admin
// list; the page script performs the actions through /api/v1/admin.
class AdminPageController extends Controller
{
    // Poster Studio is not part of the Laravel backend yet (see README).
    public const TABS = ['Overview', 'Users', 'Businesses', 'Approvals', 'QR Boards', 'Visitors', 'Analytics', 'SEO', 'Reports'];

    public const ROLES = ['CUSTOMER', 'BUSINESS_OWNER', 'DEALER', 'ADMIN'];

    public const STATUSES = ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'];

    public const BIZ_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'SUSPENDED'];

    public const PRIVILEGE_LABELS = ['MANAGE_LISTINGS' => 'Manage listings', 'MANAGE_LEADS' => 'Manage leads', 'MANAGE_BOOKINGS' => 'Manage bookings'];

    public const REPORT_PAGE_SIZE = 10;

    public const PAGE_RANGES = ['today' => 'Today', '7d' => '7 days', '30d' => '30 days', 'all' => 'All time'];

    public function __invoke(Request $request)
    {
        $tab = in_array($request->query('tab'), self::TABS, true) ? $request->query('tab') : 'Overview';
        $page = max(1, (int) $request->query('page', 1));
        $q = fn (string $key) => is_string($request->query($key)) && $request->query($key) !== '' ? $request->query($key) : null;

        $data = ['stats' => InternalApi::tryCall([AdminController::class, 'stats'], [], [], true)['data'] ?? []];

        switch ($tab) {
            case 'Users':
                $data['users'] = InternalApi::tryCall([AdminController::class, 'listUsers'], array_filter([
                    'search' => $q('search'), 'role' => $q('role'), 'page' => $page,
                ]), [], true);
                break;
            case 'Businesses':
                $data['businesses'] = InternalApi::tryCall([AdminController::class, 'listBusinesses'], array_filter([
                    'search' => $q('search'), 'status' => $q('status'), 'businessType' => $q('businessType'), 'page' => $page,
                ]), [], true);
                $data['categories'] = InternalApi::tryCall([CategoryController::class, 'index'])['data'] ?? [];
                break;
            case 'Approvals':
                $data['pending'] = InternalApi::tryCall([AdminController::class, 'listPendingBusinesses'], ['page' => $page], [], true);
                break;
            case 'QR Boards':
                $data['qr'] = InternalApi::tryCall([QrCodeController::class, 'index'], array_filter([
                    'search' => $q('search'), 'status' => $q('status'), 'page' => $page,
                ]), [], true);
                break;
            case 'Visitors':
                $data['visitors'] = InternalApi::tryCall([VisitorController::class, 'index'], array_filter([
                    'search' => $q('search'), 'withLocation' => $request->boolean('located') ? 'true' : null, 'page' => $page,
                ]), [], true);
                break;
            case 'Analytics':
                $range = array_key_exists($q('range') ?? '', self::PAGE_RANGES) ? $q('range') : '7d';
                $data['range'] = $range;
                $data['online'] = InternalApi::tryCall([AnalyticsController::class, 'online'], [], [], true)['data'] ?? null;
                $data['pageStats'] = InternalApi::tryCall([AnalyticsController::class, 'pages'], ['range' => $range], [], true)['data'] ?? null;
                break;
            case 'SEO':
                $data['seo'] = InternalApi::tryCall([SeoController::class, 'adminIndex'], array_filter([
                    'search' => $q('search'), 'stage' => $q('stage'), 'kind' => $q('kind'), 'page' => $page,
                ]), [], true);
                break;
            case 'Reports':
                $data['report'] = InternalApi::tryCall([AdminController::class, 'businessCreatorsReport'], [], [], true)['data'] ?? null;
                break;
        }

        return view('pages.admin.index', ['tab' => $tab, 'page' => $page, ...$data]);
    }

    // The "Online now" list alone, for the Analytics tab's 15-second refresh.
    public function online()
    {
        $online = InternalApi::tryCall([AnalyticsController::class, 'online'], [], [], true)['data'] ?? null;

        return response()
            ->view('pages.admin.partials.online', ['visitors' => $online['online'] ?? [], 'failed' => $online === null])
            ->header('X-Online-Count', (string) count($online['online'] ?? []));
    }

    public static function roleBadge(string $role): string
    {
        return match ($role) {
            'ADMIN' => 'bg-brand-50 text-brand-700',
            'DEALER' => 'bg-violet-50 text-violet-700',
            'BUSINESS_OWNER' => 'bg-sky-50 text-sky-700',
            default => 'bg-gray-100 text-gray-600',
        };
    }

    public static function statusBadge(string $status): string
    {
        return match ($status) {
            'ACTIVE', 'PUBLISHED' => 'bg-emerald-50 text-emerald-700',
            'SUSPENDED' => 'bg-red-50 text-red-700',
            'PENDING_VERIFICATION', 'PENDING_APPROVAL' => 'bg-amber-50 text-amber-700',
            default => 'bg-gray-100 text-gray-600',
        };
    }

    // "PENDING_APPROVAL" -> "PENDING APPROVAL" (only the first underscore,
    // the way the dashboards have always shown it).
    public static function label(string $value): string
    {
        return preg_replace('/_/', ' ', $value, 1);
    }
}
