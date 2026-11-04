<?php

namespace App\Support;

use App\Models\Business;

/**
 * One Review (a feature the dealer gives the business,
 * BusinessFeatures::ONE_REVIEW): a page at /one/<slug>, opened from one QR
 * code, that shows the business's Google review link and its social media
 * profiles as one row of icons, so a customer picks where to review or
 * follow it.
 *
 * The links come from what the business entered in Reviews & QR; a network
 * it hasn't set up is simply not shown.
 * businesses.oneReviewTaps counts taps per link: { GOOGLE: 12, ... }.
 */
class OneReview
{
    // Display order on the page.
    public const LINKS = [
        'GOOGLE' => ['label' => 'Google'],
        'FACEBOOK' => ['label' => 'Facebook'],
        'INSTAGRAM' => ['label' => 'Instagram'],
        'YOUTUBE' => ['label' => 'YouTube'],
        'TIKTOK' => ['label' => 'TikTok'],
        'X' => ['label' => 'X (Twitter)'],
        'LINKEDIN' => ['label' => 'LinkedIn'],
        'SNAPCHAT' => ['label' => 'Snapchat'],
        'THREADS' => ['label' => 'Threads'],
        'PINTEREST' => ['label' => 'Pinterest'],
        'TELEGRAM' => ['label' => 'Telegram'],
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
     * @return array<int, array{key: string, label: string, href: ?string, taps: int}>
     */
    public static function links(Business $business): array
    {
        $hrefs = [
            'GOOGLE' => ReviewChannels::google($business),
            // Facebook's reviews ("recommendations") tab.
            'FACEBOOK' => ReviewChannels::facebook($business),
            'INSTAGRAM' => ReviewChannels::instagram($business),
            'YOUTUBE' => ReviewChannels::youtube($business),
            'TIKTOK' => SocialLinks::url($business, 'tiktok'),
            'X' => SocialLinks::url($business, 'x'),
            'LINKEDIN' => SocialLinks::url($business, 'linkedin'),
            'SNAPCHAT' => SocialLinks::url($business, 'snapchat'),
            'THREADS' => SocialLinks::url($business, 'threads'),
            'PINTEREST' => SocialLinks::url($business, 'pinterest'),
            'TELEGRAM' => SocialLinks::url($business, 'telegram'),
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
