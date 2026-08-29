<?php

namespace App\Http\Controllers;

use App\Models\PageView;
use App\Support\Analytics\GeoLocator;
use App\Support\Analytics\UserAgentParser;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

// Site-wide page-view tracking for the admin "Analytics" tab — every page
// load pings here (see frontend's usePageViewTracking hook), no visitor
// action needed. Distinct from VisitorController, which only records
// people who explicitly shared their phone through the welcome popup.
class AnalyticsController extends Controller
{
    // A visitor with a page view in this window counts as "online now".
    private const ONLINE_WINDOW_MINUTES = 5;

    public function pageview(Request $request)
    {
        $data = $request->validate([
            'visitorId' => ['required', 'string', 'max:64'],
            'path' => ['required', 'string', 'max:500'],
            'referrer' => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $ip = $request->ip();
        $geo = GeoLocator::locate($ip);
        $actor = $request->attributes->get('auth');

        PageView::create([
            'visitorId' => $data['visitorId'],
            'path' => $data['path'],
            'referrer' => $data['referrer'] ?? null,
            'ip' => $ip,
            'city' => $geo['city'],
            'region' => $geo['region'],
            'country' => $geo['country'],
            'latitude' => $geo['latitude'],
            'longitude' => $geo['longitude'],
            'device' => UserAgentParser::device($request->userAgent()),
            'browser' => UserAgentParser::browser($request->userAgent()),
            'userId' => $actor ? $actor['sub'] : null,
        ]);

        // Fire-and-forget from the browser's side — 204 keeps the response
        // body-free since nothing reads it.
        return ApiResponse::noContent();
    }

    // Who is on the site right now: the latest page view per visitorId
    // within the last few minutes, newest first.
    public function online(Request $request)
    {
        $since = now()->subMinutes(self::ONLINE_WINDOW_MINUTES);

        // MySQL has no simple "latest row per group" without a window
        // function or self-join; the online window is small in practice
        // (real concurrent visitors, not the whole table), so it's fetched
        // and deduped in PHP rather than reached for either of those.
        $recent = PageView::where('createdAt', '>=', $since)
            ->orderByDesc('createdAt')
            ->limit(1000)
            ->get(['visitorId', 'path', 'ip', 'city', 'region', 'country', 'device', 'browser', 'userId', 'createdAt']);

        $seen = [];
        $online = [];
        foreach ($recent as $view) {
            if (isset($seen[$view->visitorId])) {
                continue;
            }
            $seen[$view->visitorId] = true;
            $online[] = [
                'visitorId' => $view->visitorId,
                'path' => $view->path,
                'ip' => $view->ip,
                'location' => collect([$view->city, $view->region, $view->country])->filter()->implode(', ') ?: null,
                'device' => $view->device,
                'browser' => $view->browser,
                'loggedIn' => (bool) $view->userId,
                'lastSeenAt' => $view->createdAt,
            ];
        }

        return ApiResponse::ok(['online' => $online, 'count' => count($online)]);
    }

    // Most-visited pages over a range: today, the last 7/30 days, or
    // all-time.
    public function pages(Request $request)
    {
        $data = $request->validate(['range' => ['sometimes', 'nullable', 'in:today,7d,30d,all']]);
        $range = $data['range'] ?? '7d';

        $query = PageView::query();
        $since = match ($range) {
            'today' => now()->startOfDay(),
            '30d' => now()->subDays(30),
            'all' => null,
            default => now()->subDays(7),
        };
        if ($since) {
            $query->where('createdAt', '>=', $since);
        }

        $pages = $query
            ->select('path')
            ->selectRaw('COUNT(*) as views')
            ->selectRaw('COUNT(DISTINCT visitorId) as uniqueVisitors')
            ->groupBy('path')
            ->orderByDesc('views')
            ->limit(50)
            ->get()
            ->map(fn ($row) => [
                'path' => $row->path,
                'views' => (int) $row->views,
                'uniqueVisitors' => (int) $row->uniqueVisitors,
            ]);

        return ApiResponse::ok([
            'range' => $range,
            'pages' => $pages,
            'totalViews' => (int) $pages->sum('views'),
        ]);
    }
}
