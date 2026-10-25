<?php

namespace App\Support\Seo;

use Illuminate\Support\Str;

/**
 * What search engines are shown for a business: the <title>, meta
 * description and keywords (the owner's own from the SEO section, else
 * written from the listing), and schema.org LocalBusiness data so Google
 * can show the address, hours and rating. Also the SEO checklist the owner
 * sees. Works on the array payloads the pages already have.
 */
class SeoMeta
{
    public const TITLE_MAX = 60;

    public const DESCRIPTION_MAX = 160;

    public static function title(array $biz): string
    {
        if (! empty($biz['seoTitle'])) {
            return $biz['seoTitle'];
        }
        $category = $biz['category']['name'] ?? null;

        return implode(' — ', array_filter([
            $biz['name'].(! empty($biz['city']) ? " in {$biz['city']}" : ''),
            $category,
        ]));
    }

    public static function description(array $biz): string
    {
        if (! empty($biz['seoDescription'])) {
            return $biz['seoDescription'];
        }
        $text = trim(preg_replace('/\s+/', ' ', strip_tags((string) ($biz['description'] ?? ''))));
        if ($text !== '') {
            return Str::limit($text, self::DESCRIPTION_MAX - 3, '…');
        }
        $what = $biz['category']['name'] ?? 'Local business';

        return Str::limit("{$biz['name']} — {$what}".(! empty($biz['city']) ? " in {$biz['city']}" : '').'. Phone, address, opening hours, photos and reviews.', self::DESCRIPTION_MAX);
    }

    public static function keywords(array $biz): string
    {
        if (! empty($biz['seoKeywords'])) {
            return $biz['seoKeywords'];
        }

        return implode(', ', array_filter([$biz['name'], $biz['category']['name'] ?? null, $biz['city'] ?? null]));
    }

    public static function image(array $biz): ?string
    {
        return $biz['coverImageUrl'] ?? $biz['logoUrl'] ?? ($biz['photos'][0]['url'] ?? null);
    }

    /** @return array<string, mixed> schema.org LocalBusiness */
    public static function jsonLd(array $biz, string $url): array
    {
        $days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        $hours = collect($biz['hours'] ?? [])->reject(fn ($h) => ! empty($h['isClosed']))->map(fn ($h) => [
            '@type' => 'OpeningHoursSpecification',
            'dayOfWeek' => $days[$h['dayOfWeek']] ?? null,
            'opens' => $h['openTime'],
            'closes' => $h['closeTime'],
        ])->values()->all();

        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'LocalBusiness',
            'name' => $biz['name'],
            'description' => self::description($biz),
            'url' => $url,
            'telephone' => $biz['phone'] ?? null,
            'email' => $biz['email'] ?? null,
            'image' => self::image($biz),
            'address' => array_filter([
                '@type' => 'PostalAddress',
                'streetAddress' => trim(($biz['addressLine1'] ?? '').' '.($biz['addressLine2'] ?? '')) ?: null,
                'addressLocality' => $biz['city'] ?? null,
                'addressRegion' => $biz['state'] ?? null,
                'postalCode' => $biz['postalCode'] ?? null,
                'addressCountry' => $biz['country'] ?? null,
            ]),
            'geo' => isset($biz['latitude'], $biz['longitude'])
                ? ['@type' => 'GeoCoordinates', 'latitude' => $biz['latitude'], 'longitude' => $biz['longitude']]
                : null,
            'openingHoursSpecification' => $hours ?: null,
            'aggregateRating' => ($biz['reviewCount'] ?? 0) > 0
                ? ['@type' => 'AggregateRating', 'ratingValue' => round((float) $biz['avgRating'], 1), 'reviewCount' => (int) $biz['reviewCount']]
                : null,
        ]);
    }

    /**
     * The owner's to-do list for ranking well, worst-first is up to the view.
     *
     * @return array<int, array{label: string, ok: bool, tip: string}>
     */
    public static function checklist(array $biz): array
    {
        $titleLength = mb_strlen((string) ($biz['seoTitle'] ?? ''));
        $descriptionLength = mb_strlen((string) ($biz['seoDescription'] ?? ''));

        return [
            ['label' => 'Listing is published', 'ok' => ($biz['status'] ?? null) === 'PUBLISHED', 'tip' => 'Google can only list a page that is live. Submit it for approval.'],
            ['label' => 'SEO title written', 'ok' => $titleLength >= 20 && $titleLength <= self::TITLE_MAX, 'tip' => 'Write a title of 20–60 characters: your name, what you do and your city.'],
            ['label' => 'Meta description written', 'ok' => $descriptionLength >= 70 && $descriptionLength <= self::DESCRIPTION_MAX, 'tip' => 'Write 70–160 characters that make someone want to click.'],
            ['label' => 'Keywords added', 'ok' => ! empty($biz['seoKeywords']), 'tip' => 'Add the words customers type to find you, separated by commas.'],
            ['label' => 'Detailed description', 'ok' => mb_strlen((string) ($biz['description'] ?? '')) >= 150, 'tip' => 'Describe your business in at least 150 characters on the Contact section.'],
            ['label' => 'Logo uploaded', 'ok' => ! empty($biz['logoUrl']), 'tip' => 'Add your logo on the Contact section.'],
            ['label' => 'At least 3 photos', 'ok' => count($biz['photos'] ?? []) >= 3, 'tip' => 'Pages with photos get more clicks. Add them on the Photos section.'],
            ['label' => 'Opening hours set', 'ok' => count($biz['hours'] ?? []) > 0, 'tip' => 'Set your hours so Google can show when you are open.'],
            ['label' => 'Has reviews', 'ok' => ($biz['reviewCount'] ?? $biz['reviews_count'] ?? 0) > 0, 'tip' => 'Reviews show as stars in Google. Share your review QR with customers.'],
        ];
    }

    public static function score(array $checklist): int
    {
        return $checklist ? (int) round(100 * count(array_filter($checklist, fn ($c) => $c['ok'])) / count($checklist)) : 0;
    }
}
