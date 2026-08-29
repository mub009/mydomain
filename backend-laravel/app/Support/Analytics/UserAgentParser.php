<?php

namespace App\Support\Analytics;

/**
 * Just enough User-Agent sniffing for an admin-facing "what are people
 * browsing on" column — not a substitute for a real UA database. Order
 * matters in both maps: more specific tokens are checked first (e.g. Edge
 * embeds "Chrome" and "Safari" in its own UA string).
 */
class UserAgentParser
{
    private const DEVICE_PATTERNS = [
        'Tablet' => '/iPad|Tablet(?!.*Mobile)/i',
        'Mobile' => '/Mobile|iPhone|Android/i',
    ];

    private const BROWSER_PATTERNS = [
        'Edge' => '/Edg\//i',
        'Opera' => '/OPR\/|Opera/i',
        'Chrome' => '/Chrome\//i',
        'Firefox' => '/Firefox\//i',
        'Safari' => '/Safari\//i',
    ];

    public static function device(?string $userAgent): ?string
    {
        if (! $userAgent) {
            return null;
        }
        foreach (self::DEVICE_PATTERNS as $device => $pattern) {
            if (preg_match($pattern, $userAgent)) {
                return $device;
            }
        }

        return 'Desktop';
    }

    public static function browser(?string $userAgent): ?string
    {
        if (! $userAgent) {
            return null;
        }
        foreach (self::BROWSER_PATTERNS as $browser => $pattern) {
            if (preg_match($pattern, $userAgent)) {
                return $browser;
            }
        }

        return 'Other';
    }
}
