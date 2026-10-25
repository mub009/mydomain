<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Support\Seo\SeoTracker;
use Illuminate\Database\Eloquent\Builder;

// /sitemap.xml and /robots.txt — how Google finds every live listing page
// and business website without being told about each one. Search Console
// is sent the sitemap daily by `seo:sync`.
class SitemapController extends Controller
{
    // Businesses per sitemap file. Each adds up to two URLs; the protocol
    // allows 50,000 per file.
    public const PER_FILE = 10000;

    public function index()
    {
        $count = $this->live()->count();
        if ($count <= self::PER_FILE) {
            return $this->page(1);
        }

        $base = $this->base();
        $xml = '';
        for ($n = 1; $n <= (int) ceil($count / self::PER_FILE); $n++) {
            $xml .= '<sitemap><loc>'.e("{$base}/sitemap-{$n}.xml").'</loc></sitemap>';
        }

        return $this->xml('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'.$xml.'</sitemapindex>');
    }

    public function page(int $n)
    {
        $businesses = $this->live()
            ->orderBy('createdAt')
            ->skip(($n - 1) * self::PER_FILE)->take(self::PER_FILE)
            ->with('site:id,businessId,siteType,isPublished,updatedAt')
            ->get(['id', 'slug', 'status', 'updatedAt']);
        if ($n > 1 && $businesses->isEmpty()) {
            abort(404);
        }

        $xml = $n === 1 ? $this->url($this->base().'/', null, 'daily') : '';
        foreach ($businesses as $business) {
            foreach (SeoTracker::liveUrls($business) as $kind => $url) {
                $changed = $kind === 'WEBSITE' && $business->site?->updatedAt?->gt($business->updatedAt)
                    ? $business->site->updatedAt
                    : $business->updatedAt;
                $xml .= $this->url($url, $changed?->toAtomString(), 'weekly');
            }
        }

        return $this->xml('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'.$xml.'</urlset>');
    }

    public function robots()
    {
        $lines = [
            'User-agent: *',
            // Work screens and sign-in pages have nothing to list.
            'Disallow: /dashboard',
            'Disallow: /admin',
            'Disallow: /login',
            'Disallow: /register',
            'Disallow: /session/',
            '',
            'Sitemap: '.$this->base().'/sitemap.xml',
        ];

        return response(implode("\n", $lines)."\n", 200, ['Content-Type' => 'text/plain; charset=UTF-8']);
    }

    // Everything with at least one public page (see SeoTracker::liveUrls).
    private function live(): Builder
    {
        return Business::where(fn ($q) => $q->where('status', 'PUBLISHED')
            ->orWhereHas('site', fn ($s) => $s->where('siteType', 'ECOMMERCE')->where('isPublished', true)));
    }

    // Always the main site, so a sitemap fetched on a business subdomain
    // still lists main-site addresses.
    private function base(): string
    {
        return rtrim((string) config('app.url'), '/');
    }

    private function url(string $loc, ?string $lastmod, string $frequency): string
    {
        return '<url><loc>'.e($loc).'</loc>'.($lastmod ? "<lastmod>{$lastmod}</lastmod>" : '')."<changefreq>{$frequency}</changefreq></url>";
    }

    private function xml(string $body)
    {
        return response('<?xml version="1.0" encoding="UTF-8"?>'."\n".$body, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
    }
}
