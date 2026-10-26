<?php

namespace App\Support\GoldRates;

use App\Exceptions\ApiException;
use App\Models\Business;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

// What a gold-rate poster can show about its business: the values behind
// the {name}, {phone}, … placeholders of the business detail boxes, the QR
// code targets, the opening hours (the browser picks today's) and the logo.
// Read fresh each time, so a poster follows the business's current details.
class BusinessCard
{
    private const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

    private const MAX_LOGO_BYTES = 5 * 1024 * 1024;

    public static function for(?Business $business): ?array
    {
        if (! $business) {
            return null;
        }
        $business->loadMissing(['hours' => fn ($q) => $q->orderBy('dayOfWeek')]);
        $pageUrl = url("/business/{$business->slug}");

        return [
            'id' => $business->id,
            'name' => $business->name,
            'status' => $business->status,
            'city' => $business->city,
            'logoUrl' => $business->logoUrl ? "/admin/gold-rates/businesses/{$business->id}/logo?v=".substr(md5($business->logoUrl), 0, 10) : null,
            'pageUrl' => $pageUrl,
            'websiteUrl' => $business->website ?: null,
            'hours' => $business->hours->map->only(['dayOfWeek', 'openTime', 'closeTime', 'isClosed'])->values(),
            'vars' => [
                'name' => $business->name,
                'phone' => (string) $business->phone,
                'address' => collect([$business->addressLine1, $business->addressLine2, $business->city])->filter()->implode(', '),
                'city' => (string) $business->city,
                'website' => self::shortUrl($business->website),
                'page' => self::shortUrl($pageUrl),
                'instagram' => $business->instagramUsername ? '@'.ltrim($business->instagramUsername, '@') : '',
                'facebook' => self::shortUrl($business->facebookPageUrl),
                'tagline' => self::tagline($business->description),
            ],
        ];
    }

    // "https://www.shop.com/" -> "www.shop.com"
    private static function shortUrl(?string $url): string
    {
        return $url ? rtrim(preg_replace('#^https?://#i', '', trim($url)), '/') : '';
    }

    // The description's first sentence, kept short enough for one line.
    private static function tagline(?string $description): string
    {
        $text = trim(preg_replace('/\s+/', ' ', (string) $description));
        $first = preg_split('/(?<=[.!?])\s/', $text, 2)[0] ?? '';

        return Str::limit(rtrim($first), 90);
    }

    // The business's logo, fetched by the server so the poster canvas can
    // use it (a canvas drawing a cross-origin image can't be exported). Only
    // from the app's own image storage — the logo address is set by the
    // business, so anything else is refused rather than fetched.
    public static function logo(Business $business): array
    {
        $url = (string) $business->logoUrl;
        if ($url === '') {
            throw ApiException::notFound('This business has no logo');
        }

        return Cache::remember('gold-rate-logo:'.md5($url), now()->addHour(), function () use ($url) {
            if (str_starts_with($url, '/') && ! str_starts_with($url, '//')) {
                return self::localLogo($url);
            }
            if (! self::allowedHost($url)) {
                throw ApiException::badRequest("This business's logo isn't stored on this site, so it can't be used");
            }
            try {
                $response = Http::timeout(8)->withOptions(['allow_redirects' => false])->get($url);
            } catch (Throwable $e) {
                report($e);
                throw ApiException::badRequest("Could not load this business's logo");
            }
            $mime = strtolower(trim(explode(';', (string) $response->header('Content-Type'))[0]));
            $body = $response->body();
            if (! $response->successful() || ! in_array($mime, self::LOGO_TYPES, true) || strlen($body) > self::MAX_LOGO_BYTES || ! @getimagesizefromstring($body)) {
                throw ApiException::badRequest("Could not load this business's logo");
            }

            return ['mime' => $mime, 'body' => base64_encode($body)];
        });
    }

    // The CDN and bucket hosts of the image storage (config/filesystems.php
    // "spaces"), and the app itself.
    private static function allowedHost(string $url): bool
    {
        $parts = parse_url($url);
        if (! in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) || empty($parts['host'])) {
            return false;
        }
        $host = strtolower($parts['host']);
        foreach ([config('filesystems.disks.spaces.url'), config('filesystems.disks.spaces.endpoint'), config('app.url')] as $base) {
            $allowed = strtolower((string) parse_url((string) $base, PHP_URL_HOST));
            // The bucket is a subdomain of the Spaces endpoint.
            if ($allowed !== '' && ($host === $allowed || str_ends_with($host, '.'.$allowed))) {
                return true;
            }
        }

        return false;
    }

    // A logo stored in the app's own public folder ("/images/…").
    private static function localLogo(string $url): array
    {
        $public = realpath(public_path());
        $path = realpath(public_path(ltrim(parse_url($url, PHP_URL_PATH) ?? '', '/')));
        if (! $path || ! str_starts_with($path, $public.DIRECTORY_SEPARATOR) || ! is_file($path) || filesize($path) > self::MAX_LOGO_BYTES) {
            throw ApiException::notFound("Could not find this business's logo");
        }
        $body = (string) file_get_contents($path);
        $mime = (getimagesizefromstring($body) ?: [])['mime'] ?? '';
        if (! in_array($mime, self::LOGO_TYPES, true)) {
            throw ApiException::badRequest("This business's logo is not a PNG, JPEG, WebP or GIF image");
        }

        return ['mime' => $mime, 'body' => base64_encode($body)];
    }
}
