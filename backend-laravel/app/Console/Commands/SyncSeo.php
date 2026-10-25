<?php

namespace App\Console\Commands;

use App\Support\Seo\SeoTracker;
use Illuminate\Console\Command;

// Gets new and changed business pages into Google and keeps the admin's SEO
// report current: submits what's queued (plus anything still not indexed two
// days on) to the Indexing API, and asks Search Console which pages are
// indexed. Scheduled every ten minutes in routes/console.php.
class SyncSeo extends Command
{
    protected $signature = 'seo:sync {--submit= : Most pages to submit this run} {--inspect= : Most pages to check this run}';

    protected $description = 'Submit new business pages to Google and check which are indexed';

    public function handle(): int
    {
        $submit = $this->option('submit');
        $inspect = $this->option('inspect');
        $stats = SeoTracker::run($submit !== null ? (int) $submit : null, $inspect !== null ? (int) $inspect : null);

        if ($stats['tracked']) {
            $this->info("Started tracking {$stats['tracked']} published business(es).");
        }
        if (! $stats['configured']) {
            $this->warn('Google Search is not connected (GOOGLE_SEARCH_CREDENTIALS / GOOGLE_SEARCH_PROPERTY) — nothing submitted or checked.');

            return self::SUCCESS;
        }
        $this->info("Submitted {$stats['submitted']}, checked {$stats['checked']}, failed {$stats['failed']}.");

        return self::SUCCESS;
    }
}
