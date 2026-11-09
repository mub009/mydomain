<?php

namespace App\Support;

use App\Models\Business;

/**
 * The business's other social media profiles, beyond the Instagram,
 * Facebook and YouTube columns: TikTok, X, LinkedIn, Snapchat, Threads,
 * Pinterest and Telegram. Stored in businesses.socialLinks as what the owner
 * typed — a username or a full link — keyed by network, and turned into a
 * profile URL here. Edited in Social Media; shown on the One Review page.
 */
class SocialLinks
{
    // network => [label, form field, placeholder, profile URL for a username (%s)]
    public const NETWORKS = [
        'tiktok' => ['TikTok', 'socialTiktok', '@yourshop or a full TikTok link', 'https://www.tiktok.com/@%s'],
        'x' => ['X (Twitter)', 'socialX', '@yourshop or a full X link', 'https://x.com/%s'],
        'linkedin' => ['LinkedIn', 'socialLinkedin', 'company name or a full LinkedIn link', 'https://www.linkedin.com/company/%s'],
        'snapchat' => ['Snapchat', 'socialSnapchat', 'username or a full Snapchat link', 'https://www.snapchat.com/add/%s'],
        'threads' => ['Threads', 'socialThreads', '@yourshop or a full Threads link', 'https://www.threads.net/@%s'],
        'pinterest' => ['Pinterest', 'socialPinterest', 'username or a full Pinterest link', 'https://www.pinterest.com/%s'],
        'telegram' => ['Telegram', 'socialTelegram', 'channel name or a full t.me link', 'https://t.me/%s'],
    ];

    /** Validation for the form fields (socialTiktok, socialX, ...). */
    public static function rules(): array
    {
        return collect(self::NETWORKS)->mapWithKeys(fn ($n) => [$n[1] => ['sometimes', 'nullable', 'string', 'max:300']])->all();
    }

    /** What the owner typed, per form field, for the form. */
    public static function fields(Business $business): array
    {
        $raw = self::raw($business);

        return collect(self::NETWORKS)->mapWithKeys(fn ($n, $key) => [$n[1] => $raw[$key] ?? null])->all();
    }

    /** The stored value merged with the form fields present in $data. */
    public static function merge(Business $business, array $data): array
    {
        $raw = self::raw($business);
        foreach (self::NETWORKS as $key => $n) {
            if (array_key_exists($n[1], $data)) {
                $value = trim((string) $data[$n[1]]);
                if ($value === '') {
                    unset($raw[$key]);
                } else {
                    $raw[$key] = $value;
                }
            }
        }

        return $raw;
    }

    /** The profile URL for a network, or null when not set (or not a web link). */
    public static function url(Business $business, string $network): ?string
    {
        $value = trim((string) (self::raw($business)[$network] ?? ''));
        if ($value === '' || ! isset(self::NETWORKS[$network])) {
            return null;
        }
        if (preg_match('#^https?://#i', $value)) {
            return $value;
        }
        if (preg_match('#^[\w.-]+\.[a-z]{2,}/#i', $value)) {
            return "https://{$value}";
        }
        $handle = preg_replace('/[^\w.-]/u', '', ltrim($value, '@'));

        return $handle === '' ? null : sprintf(self::NETWORKS[$network][3], $handle);
    }

    private static function raw(Business $business): array
    {
        return is_array($business->socialLinks) ? $business->socialLinks : [];
    }
}
