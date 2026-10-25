<?php

namespace App\Support\Seo;

use Firebase\JWT\JWT;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Google's Indexing API ("please crawl this URL now"), Search Console's
 * sitemap submission, and its URL Inspection API ("is this URL in Google?"),
 * signed in as a service account (config/services.php "google_search").
 * Every call throws RuntimeException when Google refuses or isn't set up;
 * network failures surface as Laravel's ConnectionException.
 */
class GoogleSearch
{
    private const SCOPES = 'https://www.googleapis.com/auth/indexing https://www.googleapis.com/auth/webmasters';

    public static function configured(): bool
    {
        return self::credentials() !== null && (bool) config('services.google_search.property');
    }

    // Asks Google to crawl the URL soon — new and changed pages usually get
    // picked up within hours to a couple of days.
    public static function notifyUpdated(string $url): void
    {
        self::notify($url, 'URL_UPDATED');
    }

    // The page is gone (unpublished or deleted) — Google drops it sooner.
    public static function notifyDeleted(string $url): void
    {
        self::notify($url, 'URL_DELETED');
    }

    public static function submitSitemap(string $sitemapUrl): void
    {
        $property = rawurlencode((string) config('services.google_search.property'));
        $response = self::client()->put("https://www.googleapis.com/webmasters/v3/sites/{$property}/sitemaps/".rawurlencode($sitemapUrl));
        self::check($response, 'Sitemap submit');
    }

    private static function notify(string $url, string $type): void
    {
        $response = self::client()->post('https://indexing.googleapis.com/v3/urlNotifications:publish', ['url' => $url, 'type' => $type]);
        self::check($response, 'Indexing API');
    }

    /**
     * What Google knows about the URL.
     *
     * @return array{indexed: bool, coverageState: ?string, lastCrawledAt: ?Carbon}
     */
    public static function inspect(string $url): array
    {
        $response = self::client()->post('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', [
            'inspectionUrl' => $url,
            'siteUrl' => config('services.google_search.property'),
        ]);
        self::check($response, 'URL Inspection');

        $result = $response->json('inspectionResult.indexStatusResult', []);
        $crawled = $result['lastCrawlTime'] ?? null;

        return [
            // PASS is "URL is on Google"; PARTIAL/FAIL/NEUTRAL are not.
            'indexed' => ($result['verdict'] ?? null) === 'PASS',
            'coverageState' => isset($result['coverageState']) ? mb_substr($result['coverageState'], 0, 150) : null,
            'lastCrawledAt' => $crawled ? Carbon::parse($crawled) : null,
        ];
    }

    private static function check($response, string $what): void
    {
        if ($response->failed()) {
            $message = $response->json('error.message') ?? mb_substr($response->body(), 0, 200);
            throw new RuntimeException("{$what}: HTTP {$response->status()} — {$message}");
        }
    }

    private static function client(): PendingRequest
    {
        $bundle = config('services.google_search.ca_bundle');

        return Http::timeout(20)
            ->withOptions($bundle ? ['verify' => $bundle] : [])
            ->withToken(self::accessToken())
            ->acceptJson();
    }

    // An OAuth access token for the service account, reused until shortly
    // before it expires (they last an hour).
    private static function accessToken(): string
    {
        $key = self::credentials();
        if (! $key || ! config('services.google_search.property')) {
            throw new RuntimeException('Google Search is not set up (GOOGLE_SEARCH_CREDENTIALS / GOOGLE_SEARCH_PROPERTY)');
        }

        return Cache::remember('google-search-token:'.md5($key['client_email']), now()->addMinutes(50), function () use ($key) {
            $now = time();
            $tokenUri = $key['token_uri'] ?? 'https://oauth2.googleapis.com/token';
            $assertion = JWT::encode([
                'iss' => $key['client_email'],
                'scope' => self::SCOPES,
                'aud' => $tokenUri,
                'iat' => $now,
                'exp' => $now + 3600,
            ], $key['private_key'], 'RS256');

            $bundle = config('services.google_search.ca_bundle');
            $response = Http::timeout(20)->withOptions($bundle ? ['verify' => $bundle] : [])->asForm()->post($tokenUri, [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $assertion,
            ]);
            if ($response->failed() || ! $response->json('access_token')) {
                throw new RuntimeException('Google sign-in failed: '.($response->json('error_description') ?? $response->json('error') ?? "HTTP {$response->status()}"));
            }

            return $response->json('access_token');
        });
    }

    /** @return array{client_email: string, private_key: string, token_uri?: string}|null */
    private static function credentials(): ?array
    {
        $value = trim((string) config('services.google_search.credentials'));
        if ($value === '') {
            return null;
        }
        if (! str_starts_with($value, '{')) {
            $path = str_starts_with($value, '/') || preg_match('#^[A-Za-z]:[\\\\/]#', $value) ? $value : base_path($value);
            $value = is_file($path) ? (string) file_get_contents($path) : '';
        }
        $json = json_decode($value, true);

        return is_array($json) && ! empty($json['client_email']) && ! empty($json['private_key']) ? $json : null;
    }
}
