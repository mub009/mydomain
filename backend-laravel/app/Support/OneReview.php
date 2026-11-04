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
    // Display order. `group` splits the page into "Review us", "Follow us" and "Contact".
    public const LINKS = [
        'GOOGLE' => ['label' => 'Review us on Google', 'sub' => 'Rate us and share your experience', 'group' => 'review'],
        'AI_REVIEW' => ['label' => 'Write it with AI help', 'sub' => 'We draft it, you post it on Google', 'group' => 'review'],
        'FACEBOOK' => ['label' => 'Recommend us on Facebook', 'sub' => 'Leave a recommendation', 'group' => 'review'],
        'MARKKITO_REVIEW' => ['label' => 'Review us on Markkito', 'sub' => 'Rate us on our listing', 'group' => 'review'],
        'INSTAGRAM' => ['label' => 'Instagram', 'sub' => 'Follow us', 'group' => 'follow'],
        'FACEBOOK_PAGE' => ['label' => 'Facebook', 'sub' => 'Like our page', 'group' => 'follow'],
        'YOUTUBE' => ['label' => 'YouTube', 'sub' => 'Subscribe', 'group' => 'follow'],
        'TIKTOK' => ['label' => 'TikTok', 'sub' => 'Follow us', 'group' => 'follow'],
        'X' => ['label' => 'X (Twitter)', 'sub' => 'Follow us', 'group' => 'follow'],
        'LINKEDIN' => ['label' => 'LinkedIn', 'sub' => 'Connect', 'group' => 'follow'],
        'SNAPCHAT' => ['label' => 'Snapchat', 'sub' => 'Add us', 'group' => 'follow'],
        'THREADS' => ['label' => 'Threads', 'sub' => 'Follow us', 'group' => 'follow'],
        'PINTEREST' => ['label' => 'Pinterest', 'sub' => 'Follow us', 'group' => 'follow'],
        'TELEGRAM' => ['label' => 'Telegram', 'sub' => 'Join us', 'group' => 'follow'],
        'WHATSAPP' => ['label' => 'WhatsApp', 'sub' => 'Chat with us', 'group' => 'contact'],
        'CALL' => ['label' => 'Call us', 'sub' => 'Talk to us', 'group' => 'contact'],
        'WEBSITE' => ['label' => 'Website', 'sub' => 'Visit us online', 'group' => 'contact'],
        'DIRECTIONS' => ['label' => 'Directions', 'sub' => 'Find our shop', 'group' => 'contact'],
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
            'FACEBOOK_PAGE' => self::facebookPage($business),
            'YOUTUBE' => ReviewChannels::youtube($business),
            'TIKTOK' => SocialLinks::url($business, 'tiktok'),
            'X' => SocialLinks::url($business, 'x'),
            'LINKEDIN' => SocialLinks::url($business, 'linkedin'),
            'SNAPCHAT' => SocialLinks::url($business, 'snapchat'),
            'THREADS' => SocialLinks::url($business, 'threads'),
            'PINTEREST' => SocialLinks::url($business, 'pinterest'),
            'TELEGRAM' => SocialLinks::url($business, 'telegram'),
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

    // The Facebook page itself (to like and follow), not its reviews tab.
    private static function facebookPage(Business $business): ?string
    {
        $url = ReviewChannels::facebook($business);

        return $url ? preg_replace('#/reviews/?$#', '', $url) : null;
    }

    public static function countTap(Business $business, string $key): void
    {
        $taps = is_array($business->oneReviewTaps) ? $business->oneReviewTaps : [];
        $taps[$key] = (int) ($taps[$key] ?? 0) + 1;
        $business->forceFill(['oneReviewTaps' => $taps])->saveQuietly();
    }
}
