<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\SeoPage;
use App\Support\AiWriter;
use App\Support\ApiResponse;
use App\Support\BusinessAccess;
use App\Support\Pagination;
use App\Support\Seo\GoogleSearch;
use App\Support\Seo\SeoMeta;
use App\Support\Seo\SeoTracker;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

// SEO: the owner's view of one business (what Google is shown, a checklist,
// and whether its pages are in Google yet), and the admin's report across
// every tracked page. The SEO text itself is saved with PATCH /businesses/{id}.
class SeoController extends Controller
{
    public const STAGES = ['INDEXED', 'WAITING', 'OVERDUE'];

    public function forBusiness(Request $request, string $id)
    {
        $business = Business::with([
            'category',
            'photos' => fn ($q) => $q->orderBy('sortOrder'),
            'hours' => fn ($q) => $q->orderBy('dayOfWeek'),
        ])->find($id);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        BusinessAccess::assertCanManage($request->attributes->get('auth'), $business);

        $biz = $business->toArray();
        $checklist = SeoMeta::checklist($biz);

        return ApiResponse::ok([
            ...$business->only(['id', 'name', 'slug', 'status', 'seoTitle', 'seoDescription', 'seoKeywords']),
            'preview' => [
                'title' => SeoMeta::title($biz),
                'description' => SeoMeta::description($biz),
                'url' => SeoTracker::listingUrl($business->slug),
            ],
            'checklist' => $checklist,
            'score' => SeoMeta::score($checklist),
            'pages' => SeoPage::where('businessId', $id)->orderBy('kind')->get(),
            'googleConnected' => GoogleSearch::configured(),
            'targetHours' => SeoPage::TARGET_HOURS,
        ]);
    }

    // An SEO title, description and keywords written from the listing
    // (App\Support\AiWriter). Nothing is saved — the form shows the draft
    // for the owner to keep or edit.
    public function generate(Request $request, string $id)
    {
        $business = Business::with([
            'category',
            'services' => fn ($q) => $q->where('isActive', true)->orderBy('createdAt'),
        ])->find($id);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        BusinessAccess::assertCanManage($request->attributes->get('auth'), $business);

        return ApiResponse::ok(AiWriter::seo([
            'name' => $business->name,
            'category' => $business->category?->name ?? 'Local business',
            'city' => $business->city,
            'businessType' => $business->businessType,
            'description' => $business->description,
            'services' => $business->services->pluck('name')->all(),
        ]));
    }

    public function adminIndex(Request $request)
    {
        $request->validate([
            'stage' => ['sometimes', 'nullable', 'in:'.implode(',', self::STAGES)],
            'kind' => ['sometimes', 'nullable', 'in:LISTING,WEBSITE'],
            'search' => ['sometimes', 'nullable', 'string', 'max:150'],
        ]);
        $pagination = Pagination::parse($request->query());

        $query = SeoPage::query();
        if ($stage = $request->query('stage')) {
            self::whereStage($query, $stage);
        }
        if ($kind = $request->query('kind')) {
            $query->where('kind', $kind);
        }
        if ($search = $request->query('search')) {
            $query->where(fn ($q) => $q->where('url', 'like', "%{$search}%")
                ->orWhereHas('business', fn ($b) => $b->where('name', 'like', "%{$search}%")->orWhere('city', 'like', "%{$search}%")));
        }

        $total = (clone $query)->count();
        // Overdue first, then the newest — what needs a look is on top.
        $deadline = now()->subHours(SeoPage::TARGET_HOURS);
        $items = $query
            ->orderByRaw("case when indexStatus <> 'INDEXED' and createdAt < ? then 0 else 1 end", [$deadline])
            ->orderByDesc('createdAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with('business:id,name,slug,city')
            ->get();

        $summary = ['total' => SeoPage::count()];
        foreach (self::STAGES as $s) {
            $summary[strtolower($s)] = self::whereStage(SeoPage::query(), $s)->count();
        }
        $summary['queued'] = SeoPage::where('needsSubmit', true)->count();
        $summary['failing'] = SeoPage::whereNotNull('submitError')->count();
        // Of the pages that were found inside the window, how many made it.
        $summary['indexedInTarget'] = SeoPage::where('indexStatus', 'INDEXED')
            ->whereRaw($this->hoursBetween('createdAt', 'indexedAt').' <= ?', [SeoPage::TARGET_HOURS])->count();

        return ApiResponse::paginated($items, [
            'page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total,
            'summary' => $summary,
            'googleConnected' => GoogleSearch::configured(),
            'targetHours' => SeoPage::TARGET_HOURS,
        ]);
    }

    public function adminSubmit(string $id)
    {
        $page = $this->pageOrFail($id);
        $this->requireGoogle();
        if (! SeoTracker::submit($page)) {
            throw ApiException::badRequest($page->submitError ?? 'Google refused the request');
        }

        return ApiResponse::ok($page->fresh());
    }

    public function adminCheck(string $id)
    {
        $page = $this->pageOrFail($id);
        $this->requireGoogle();
        if (! SeoTracker::check($page)) {
            throw ApiException::badRequest($page->coverageState ?? 'Google could not inspect the page');
        }

        return ApiResponse::ok($page->fresh());
    }

    // The same pass the scheduler makes, on demand.
    public function adminRun()
    {
        return ApiResponse::ok(SeoTracker::run());
    }

    public static function whereStage(Builder $query, string $stage): Builder
    {
        $deadline = now()->subHours(SeoPage::TARGET_HOURS);

        return match ($stage) {
            'INDEXED' => $query->where('indexStatus', 'INDEXED'),
            'WAITING' => $query->where('indexStatus', '!=', 'INDEXED')->where('createdAt', '>=', $deadline),
            'OVERDUE' => $query->where('indexStatus', '!=', 'INDEXED')->where('createdAt', '<', $deadline),
        };
    }

    private function hoursBetween(string $from, string $to): string
    {
        return match (SeoPage::query()->getConnection()->getDriverName()) {
            'sqlite' => "(julianday({$to}) - julianday({$from})) * 24",
            default => "timestampdiff(hour, {$from}, {$to})",
        };
    }

    private function pageOrFail(string $id): SeoPage
    {
        return SeoPage::find($id) ?? throw ApiException::notFound('Page not found');
    }

    private function requireGoogle(): void
    {
        if (! GoogleSearch::configured()) {
            throw ApiException::badRequest('Google Search is not connected — set GOOGLE_SEARCH_CREDENTIALS and GOOGLE_SEARCH_PROPERTY');
        }
    }
}
