<?php

namespace App\Support;

use App\Models\Business;
use App\Support\Cards\CardEngine;

/**
 * One Review (a feature the dealer gives the business,
 * BusinessFeatures::ONE_REVIEW): a page at /one/<slug>, opened from one QR
 * code, that shows every review and social link the business has set up —
 * Google, Facebook, Instagram, YouTube, WhatsApp, call, website, directions —
 * so a customer picks where to review or follow it.
 *
 * The links come from what the business already entered (Reviews & QR and
 * Contact); a link it hasn't set up is simply not shown.
 * businesses.oneReviewTaps counts taps per link: { GOOGLE: 12, ... }.
 */
class OneReview
{
    // Display order. `group` splits the page into "Review us" and "Follow & contact".
    public const LINKS = [
        'GOOGLE' => ['label' => 'Review us on Google', 'sub' => 'Rate us and share your experience', 'group' => 'review'],
        'AI_REVIEW' => ['label' => 'Write it with AI help', 'sub' => 'We draft it, you post it on Google', 'group' => 'review'],
        'FACEBOOK' => ['label' => 'Recommend us on Facebook', 'sub' => 'Leave a recommendation', 'group' => 'review'],
        'MARKKITO_REVIEW' => ['label' => 'Review us on Markkito', 'sub' => 'Rate us on our listing', 'group' => 'review'],
        'INSTAGRAM' => ['label' => 'Follow on Instagram', 'sub' => null, 'group' => 'follow'],
        'YOUTUBE' => ['label' => 'Subscribe on YouTube', 'sub' => null, 'group' => 'follow'],
        'WHATSAPP' => ['label' => 'Chat on WhatsApp', 'sub' => null, 'group' => 'follow'],
        'CALL' => ['label' => 'Call us', 'sub' => null, 'group' => 'follow'],
        'WEBSITE' => ['label' => 'Visit our website', 'sub' => null, 'group' => 'follow'],
        'DIRECTIONS' => ['label' => 'Get directions', 'sub' => null, 'group' => 'follow'],
    ];

    public static function url(Business $business): string
    {
        return rtrim((string) config('app.url'), '/')."/one/{$business->slug}";
    }

    /** The public page is up while the listing is live and has the feature. */
    public static function live(Business $business): bool
    {
        return $business->status === 'PUBLISHED' && BusinessFeatures::has($business, BusinessFeatures::ONE_REVIEW);
    }

    /**
     * Every link, set up or not (href null), for the dashboard.
     *
     * @return array<int, array{key: string, label: string, sub: ?string, group: string, href: ?string, taps: int}>
     */
    public static function links(Business $business): array
    {
        $card = CardEngine::details($business);
        $hrefs = [
            'GOOGLE' => ReviewChannels::google($business),
            'AI_REVIEW' => AiReview::live($business) ? AiReview::url($business) : null,
            'FACEBOOK' => ReviewChannels::facebook($business),
            'MARKKITO_REVIEW' => ReviewChannels::markkitoReview($business),
            'INSTAGRAM' => ReviewChannels::instagram($business),
            'YOUTUBE' => ReviewChannels::youtube($business),
            'WHATSAPP' => $card['whatsappHref'],
            'CALL' => $card['phoneHref'],
            'WEBSITE' => ReviewChannels::website($business),
            'DIRECTIONS' => ReviewChannels::directions($business),
        ];
        $taps = is_array($business->oneReviewTaps) ? $business->oneReviewTaps : [];

        return collect(self::LINKS)->map(fn ($l, $key) => [
            'key' => $key, ...$l,
            'href' => $hrefs[$key] ?? null,
            'taps' => (int) ($taps[$key] ?? 0),
        ])->values()->all();
    }

    /** Only the links the business has set up, for the public page. */
    public static function active(Business $business): array
    {
        return array_values(array_filter(self::links($business), fn ($l) => $l['href'] !== null));
    }

    public static function countTap(Business $business, string $key): void
    {
        $taps = is_array($business->oneReviewTaps) ? $business->oneReviewTaps : [];
        $taps[$key] = (int) ($taps[$key] ?? 0) + 1;
        $business->forceFill(['oneReviewTaps' => $taps])->saveQuietly();
    }
}
