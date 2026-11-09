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
 * The links come from what the business entered in Reviews & QR and Social Media; a network
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

    // The page's looks: key => [name, swatch background, swatch card colour, swatch text colour].
    public const STYLES = [
        'classic' => ['Classic', 'linear-gradient(135deg,#0f172a,#134e4a 55%,#0f9e68)', '#ffffff', '#0f172a'],
        'minimal' => ['Minimal', '#ffffff', '#ffffff', '#111827'],
        'midnight' => ['Midnight', 'linear-gradient(135deg,#1e1b4b,#0f172a 60%,#0e7490)', '#111a2e', '#f1f5f9'],
        'sunset' => ['Sunset', 'linear-gradient(160deg,#ff9a5a,#ff5e7e 55%,#a855f7)', '#ffffff', '#3b0a2a'],
        'ocean' => ['Ocean', 'linear-gradient(160deg,#0ea5e9,#2563eb 60%,#1e3a8a)', '#ffffff', '#0c1e4a'],
        'forest' => ['Forest', 'linear-gradient(135deg,#052e16,#166534)', '#fefce8', '#1a2e05'],
        'gold' => ['Royal Gold', 'linear-gradient(135deg,#3a2a10,#b8860b 50%,#1a1206)', '#141414', '#e7c873'],
        'pastel' => ['Pastel', 'linear-gradient(135deg,#fbcfe8,#c4b5fd)', '#ffffff', '#4c1d95'],
        'neon' => ['Neon', 'linear-gradient(135deg,#7c3aed,#db2777 50%,#06b6d4)', '#0d0620', '#f5f3ff'],
        'glass' => ['Glass', 'linear-gradient(135deg,#334155,#64748b 50%,#0f9e68)', 'rgba(255,255,255,.35)', '#ffffff'],
    ];

    public const DEFAULT_STYLE = 'classic';

    /** The business's style, or the default when unset or unknown. */
    public static function style(Business $business): string
    {
        return isset(self::STYLES[$business->oneReviewStyle]) ? $business->oneReviewStyle : self::DEFAULT_STYLE;
    }

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
