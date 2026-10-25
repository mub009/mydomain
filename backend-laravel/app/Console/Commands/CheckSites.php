<?php

namespace App\Console\Commands;

use App\Models\Business;
use App\Support\SiteUrl;
use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

// Says why a business subdomain does or doesn't show its website: the
// configured domain, stale config/route caches, and what a given host
// actually routes to.
class CheckSites extends Command
{
    protected $signature = 'sites:check {host? : A host to try, e.g. cafe-kapichino-2.mydomainbook.com}';

    protected $description = 'Diagnose business websites on subdomains';

    public function handle(): int
    {
        $domain = config('sites.domain');
        $this->line('SITE_DOMAIN (as read): '.($domain ?? '<empty>'));
        $this->line('Config cached: '.($this->laravel->configurationIsCached() ? 'yes' : 'no'));
        $this->line('Routes cached: '.($this->laravel->routesAreCached() ? 'yes' : 'no'));

        $problems = 0;
        if (! $domain) {
            $this->error('SITE_DOMAIN is empty, so subdomains are off and every subdomain shows the Markkito home page.');
            $this->line($this->laravel->configurationIsCached()
                ? '  Config is cached: set SITE_DOMAIN in .env, then run `php artisan config:clear`.'
                : '  Set SITE_DOMAIN=mydomainbook.com in .env.');
            $problems++;
        }

        $hasRoute = collect(Route::getRoutes()->getRoutes())->contains(fn ($r) => $r->getDomain() && str_contains($r->getDomain(), '{slug}'));
        if ($domain && ! $hasRoute) {
            $this->error('The subdomain route is missing from the loaded routes.');
            $this->line($this->laravel->routesAreCached()
                ? '  The route cache was built before SITE_DOMAIN was set: run `php artisan route:clear` (or `route:cache` again).'
                : '  Is this server on the latest code? routes/web.php should register Route::domain(\'{slug}.\'...).');
            $problems++;
        }

        $host = $this->argument('host') ?? ($domain ? (Business::where('status', 'PUBLISHED')->value('slug') ?? 'example').".{$domain}" : null);
        if ($host) {
            $this->line("Trying http://{$host}/ …");
            try {
                $route = Route::getRoutes()->match(Request::create("http://{$host}/"));
                $slug = $route->parameter('slug');
                if ($route->getDomain() && $slug) {
                    $business = Business::where('slug', $slug)->first();
                    $this->info("  → the website for \"{$slug}\"".($business ? " ({$business->name}, {$business->status})" : ' — but no business has that slug, so it shows "Website not available"'));
                    $this->line('  Public address: '.SiteUrl::for($slug));
                } else {
                    $this->warn('  → the Markkito home page, not a business website.');
                    if ($domain && ! str_ends_with(strtolower($host), ".{$domain}")) {
                        $this->line("  The host does not end in .{$domain}.");
                    }
                    $problems++;
                }
            } catch (NotFoundHttpException) {
                $this->warn('  → no route (404).');
                $problems++;
            }
        }

        if ($problems === 0) {
            $this->info('Laravel side looks right. If a browser still gets the home page, the request is reaching a different copy of the site: check the wildcard subdomain\'s document root and that the server runs this code.');
        }

        return $problems === 0 ? self::SUCCESS : self::FAILURE;
    }
}
