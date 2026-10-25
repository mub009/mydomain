<?php

namespace App\Support;

// The public address of a business's own website: its subdomain when one is
// configured (config/sites.php), otherwise the /site/<slug> path.
class SiteUrl
{
    public static function for(string $slug): string
    {
        $domain = config('sites.domain');
        if (! $domain) {
            return url("/site/{$slug}");
        }
        $port = config('sites.port');

        return config('sites.scheme')."://{$slug}.{$domain}".($port ? ":{$port}" : '');
    }

    // A link from a business website back to Markkito itself. On a
    // subdomain a plain path would stay on the business's host, so it
    // points at the main site (APP_URL) instead.
    public static function markkito(string $path): string
    {
        return config('sites.domain') ? rtrim(config('app.url'), '/').$path : $path;
    }

    // The route constraint for a slug in a subdomain: what slugs are made
    // of (see BusinessController::uniqueSlug), minus the reserved names. The
    // lookahead runs on into the host, so "www." is refused but "www-cafe"
    // is not.
    public static function slugPattern(): string
    {
        $reserved = implode('|', array_map('preg_quote', config('sites.reserved')));

        return "(?!(?:{$reserved})\.)[a-z0-9-]+";
    }
}
