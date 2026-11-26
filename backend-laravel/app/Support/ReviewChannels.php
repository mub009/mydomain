<?php

namespace App\Support;

use App\Models\Business;

// Resolves a business's review/contact channels to a URL. $source is any
// array-ish (Eloquent model or plain array) carrying the same field names as
// the Business model: googlePlaceId, googleReviewUrl, instagramUsername,
// facebookPageUrl, youtubeUrl, website, latitude, longitude, slug.
class ReviewChannels
{
    public const ALL = [
        'GOOGLE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WEBSITE', 'DIRECTIONS', 'MARKKITO', 'MARKKITO_REVIEW', 'AI_REVIEW', 'ONE_REVIEW',
    ];

    private static function get(mixed $source, string $key): mixed
    {
        return is_array($source) ? ($source[$key] ?? null) : $source->{$key} ?? null;
    }

    // Google's canonical "write a review" deep link. Scanning it on a phone
    // opens the Maps app straight on the review composer for that place.
    public static function google(mixed $source): ?string
    {
        if ($url = self::get($source, 'googleReviewUrl')) {
            return $url;
        }
        if ($placeId = self::get($source, 'googlePlaceId')) {
            return 'https://search.google.com/local/writereview?placeid='.rawurlencode($placeId);
        }

        return null;
    }

    public static function instagram(mixed $source): ?string
    {
        $username = self::get($source, 'instagramUsername');
        if (! $username) {
            return null;
        }

        return 'https://www.instagram.com/'.ltrim($username, '@').'/';
    }

    public static function facebook(mixed $source): ?string
    {
        $raw = trim((string) self::get($source, 'facebookPageUrl'));
        if ($raw === '') {
            return null;
        }
        $base = preg_match('#^https?://#i', $raw)
            ? rtrim($raw, '/')
            : 'https://www.facebook.com/'.ltrim($raw, '/');

        return str_contains($base, '/reviews') ? $base : "{$base}/reviews";
    }

    public static function youtube(mixed $source): ?string
    {
        $raw = trim((string) self::get($source, 'youtubeUrl'));
        if ($raw === '') {
            return null;
        }
        if (preg_match('#^https?://#i', $raw)) {
            return $raw;
        }

        return 'https://www.youtube.com/'.(str_starts_with($raw, '@') ? $raw : "@{$raw}");
    }

    // Turn-by-turn navigation to the shop. Built from the coordinates
    // already on the listing, so it needs no setup from the owner and is
    // always available.
    public static function directions(mixed $source): ?string
    {
        $lat = self::get($source, 'latitude');
        $lng = self::get($source, 'longitude');
        if ($lat === null || $lng === null) {
            return null;
        }

        return "https://www.google.com/maps/dir/?api=1&destination={$lat},{$lng}";
    }

    public static function website(mixed $source): ?string
    {
        $raw = trim((string) self::get($source, 'website'));
        if ($raw === '') {
            return null;
        }

        return preg_match('#^https?://#i', $raw) ? $raw : "https://{$raw}";
    }

    // The shop's own page on Markkito. Unlike every other channel this
    // needs nothing from the owner — the slug exists as soon as the listing
    // does — so a board pointed here works from the moment it is assigned.
    public static function markkito(mixed $source): ?string
    {
        $slug = self::get($source, 'slug');
        if (! $slug) {
            return null;
        }

        return config('frontend.origin')."/business/{$slug}";
    }

    // Same page, opened on the review composer, for boards whose whole
    // purpose is collecting reviews on Markkito.
    public static function markkitoReview(mixed $source): ?string
    {
        $base = self::markkito($source);

        return $base ? "{$base}?review=1" : null;
    }

    // The business's AI Google Review page (customers get a review written
    // for them, then post it on Google) — when it has that feature.
    public static function aiReview(mixed $source): ?string
    {
        return self::featurePage($source, BusinessFeatures::AI_REVIEW, 'review');
    }

    // Its One Review page: every review and social link on one screen — when it has that feature.
    public static function oneReview(mixed $source): ?string
    {
        return self::featurePage($source, BusinessFeatures::ONE_REVIEW, 'one');
    }

    private static function featurePage(mixed $source, string $feature, string $path): ?string
    {
        $slug = self::get($source, 'slug');
        if (! $slug || (($source instanceof Business || is_array($source)) && ! BusinessFeatures::has($source, $feature))) {
            return null;
        }

        return config('frontend.origin')."/{$path}/{$slug}";
    }

    public static function resolve(mixed $source, string $channel): ?string
    {
        return match ($channel) {
            'GOOGLE' => self::google($source),
            'INSTAGRAM' => self::instagram($source),
            'FACEBOOK' => self::facebook($source),
            'YOUTUBE' => self::youtube($source),
            'WEBSITE' => self::website($source),
            'DIRECTIONS' => self::directions($source),
            'MARKKITO' => self::markkito($source),
            'MARKKITO_REVIEW' => self::markkitoReview($source),
            'AI_REVIEW' => self::aiReview($source),
            'ONE_REVIEW' => self::oneReview($source),
            default => null,
        };
    }

    // Which channels this business has actually configured, in display order.
    public static function available(mixed $source): array
    {
        // Markkito channels are last on purpose: they always resolve, so
        // putting them earlier would silently become the fallback for every
        // board that has no channel set.
        $order = ['GOOGLE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WEBSITE', 'DIRECTIONS', 'AI_REVIEW', 'ONE_REVIEW', 'MARKKITO_REVIEW', 'MARKKITO'];

        return array_values(array_filter($order, fn ($channel) => self::resolve($source, $channel) !== null));
    }
}
