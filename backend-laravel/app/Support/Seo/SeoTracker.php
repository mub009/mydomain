<?php

namespace App\Support\Seo;

use App\Models\Business;
use App\Models\SeoPage;
use App\Support\SiteUrl;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Which of a business's pages belong in Google, and getting them there.
 * sync() runs whenever a business or its website changes (see the models'
 * booted() hooks) and only touches the database; run() — the `seo:sync`
 * command, every ten minutes — does the talking to Google.
 */
class SeoTracker
{
    // How often a page is re-inspected: hours while it isn't in Google yet,
    // days once it is.
    public const RECHECK_PENDING_HOURS = 6;

    public const RECHECK_INDEXED_DAYS = 7;

    /**
     * The business's pages that are public right now, by kind — the same
     * rules BusinessController::show and SiteController::published follow
     * (a shop is open once published; a brochure website is live with the
     * listing).
     *
     * @return array<string, string>
     */
    public static function liveUrls(Business $business): array
    {
        $urls = [];
        if ($business->status === 'PUBLISHED') {
            $urls['LISTING'] = self::listingUrl($business->slug);
        }
        $site = $business->site;
        $websiteLive = $site?->siteType === 'ECOMMERCE' ? $site->isPublished : $business->status === 'PUBLISHED';
        if ($websiteLive) {
            $urls['WEBSITE'] = self::websiteUrl($business->slug);
        }

        return $urls;
    }

    // Built from APP_URL rather than the current request, so a save made on
    // a business subdomain still records the main-site address.
    public static function listingUrl(string $slug): string
    {
        return rtrim((string) config('app.url'), '/')."/business/{$slug}";
    }

    // The website's canonical address — the one site.blade.php names.
    public static function websiteUrl(string $slug): string
    {
        return config('sites.domain')
            ? SiteUrl::for($slug).'/'
            : rtrim((string) config('app.url'), '/')."/site/{$slug}";
    }

    // Brings the tracked pages in line with what's live: new pages are
    // added, pages that are still live are queued to be re-crawled (their
    // content changed), and pages that aren't live any more are dropped.
    public static function sync(Business $business): void
    {
        $business->unsetRelation('site');
        $live = self::liveUrls($business);
        $pages = SeoPage::where('businessId', $business->id)->get()->keyBy('kind');

        foreach ($pages as $kind => $page) {
            // A new address is a new page as far as Google is concerned, so
            // its two-day clock starts again too.
            if (($live[$kind] ?? null) !== $page->url) {
                $page->delete();
                $pages->forget($kind);
            }
        }
        foreach ($live as $kind => $url) {
            if ($page = $pages->get($kind)) {
                $page->update(['needsSubmit' => true]);
            } else {
                SeoPage::create(['businessId' => $business->id, 'kind' => $kind, 'url' => $url, 'needsSubmit' => true]);
            }
        }
    }

    /**
     * One pass of the scheduled job: start tracking published businesses
     * that predate this feature, submit what's queued (and what still isn't
     * in Google two days on), and check what's due a check.
     *
     * @return array{configured: bool, tracked: int, submitted: int, checked: int, failed: int}
     */
    public static function run(?int $submitLimit = null, ?int $inspectLimit = null): array
    {
        $stats = ['configured' => GoogleSearch::configured(), 'tracked' => self::backfill(), 'submitted' => 0, 'checked' => 0, 'failed' => 0];
        if (! $stats['configured']) {
            return $stats;
        }

        // The sitemap, once a day, so Google also finds pages on its own.
        if (! Cache::has('seo:sitemap-submitted')) {
            try {
                GoogleSearch::submitSitemap(rtrim((string) config('app.url'), '/').'/sitemap.xml');
                Cache::put('seo:sitemap-submitted', true, now()->addDay());
            } catch (Throwable $e) {
                report($e);
            }
        }

        $toSubmit = SeoPage::where(fn ($q) => $q->where('needsSubmit', true)->orWhere(fn ($q) => $q
            ->where('indexStatus', '!=', 'INDEXED')
            ->where('submittedAt', '<', now()->subHours(SeoPage::TARGET_HOURS))))
            // Least recently touched first, so a page that keeps failing
            // moves behind the rest instead of holding up the queue.
            ->orderBy('updatedAt')
            ->limit($submitLimit ?? config('services.google_search.submit_per_run'))
            ->get();
        foreach ($toSubmit as $page) {
            $ok = self::submit($page);
            $stats[$ok ? 'submitted' : 'failed']++;
            // Out of quota for today — the rest wait for the next run.
            if (! $ok && str_contains((string) $page->submitError, 'HTTP 429')) {
                break;
            }
        }

        // Once sent — or live for an hour, as Google may have found it
        // through the sitemap even if sending it failed.
        $toCheck = SeoPage::where(fn ($q) => $q->whereNotNull('firstSubmittedAt')->orWhere('createdAt', '<', now()->subHour()))
            ->where(fn ($q) => $q->whereNull('checkedAt')
                ->orWhere(fn ($q) => $q->where('indexStatus', '!=', 'INDEXED')->where('checkedAt', '<', now()->subHours(self::RECHECK_PENDING_HOURS)))
                ->orWhere('checkedAt', '<', now()->subDays(self::RECHECK_INDEXED_DAYS)))
            ->orderByRaw('checkedAt is not null')->orderBy('checkedAt')
            ->limit($inspectLimit ?? config('services.google_search.inspect_per_run'))
            ->get();
        foreach ($toCheck as $page) {
            $stats[self::check($page) ? 'checked' : 'failed']++;
        }

        return $stats;
    }

    // Asks Google to crawl the page. A failure is kept on the page for the
    // reports, and the page stays queued (behind the others) to try again.
    public static function submit(SeoPage $page): bool
    {
        try {
            GoogleSearch::notifyUpdated($page->url);
        } catch (Throwable $e) {
            $page->submitError = mb_substr($e->getMessage(), 0, 500);
            // Touched even when the message is the same, for the queue order.
            $page->touch();

            return false;
        }
        $page->update([
            'needsSubmit' => false,
            'submittedAt' => now(),
            'firstSubmittedAt' => $page->firstSubmittedAt ?? now(),
            'submitCount' => $page->submitCount + 1,
            'submitError' => null,
        ]);

        return true;
    }

    // Asks Google whether the page is indexed and records the answer.
    public static function check(SeoPage $page): bool
    {
        try {
            $result = GoogleSearch::inspect($page->url);
        } catch (Throwable $e) {
            $page->update(['indexStatus' => 'ERROR', 'coverageState' => mb_substr($e->getMessage(), 0, 150), 'checkedAt' => now()]);

            return false;
        }
        $page->update([
            'indexStatus' => $result['indexed'] ? 'INDEXED' : 'NOT_INDEXED',
            'coverageState' => $result['coverageState'],
            'lastCrawledAt' => $result['lastCrawledAt'],
            'checkedAt' => now(),
            'indexedAt' => $result['indexed'] ? ($page->indexedAt ?? now()) : null,
        ]);

        return true;
    }

    // Published businesses with no tracked pages yet — the ones that went
    // live before this existed. Returns how many it picked up.
    private static function backfill(): int
    {
        $missing = Business::where('status', 'PUBLISHED')->whereDoesntHave('seoPages')->limit(500)->get();
        $missing->each(fn (Business $business) => self::sync($business));

        return $missing->count();
    }
}
