<?php

namespace App\Support;

use App\Exceptions\ApiException;
use App\Models\Business;

// What a business gets beyond its listing — chosen by the dealer who sets it
// up, a point each (Points::spendForFeature): its own website on a
// subdomain, the digital visiting card, gold-rate posters, and AI-written
// Google reviews for its customers. A business
// sees and uses only the features it has.
//
// businesses.features null means every feature: listings from before
// features existed keep what they had, and listings made by an admin or by
// the owner themselves get them all, free.
class BusinessFeatures
{
    public const WEBSITE = 'WEBSITE';

    public const VISITING_CARD = 'VISITING_CARD';

    public const GOLD_RATE = 'GOLD_RATE';

    public const AI_REVIEW = 'AI_REVIEW';

    public const ONE_REVIEW = 'ONE_REVIEW';

    public const ALL = [self::WEBSITE, self::VISITING_CARD, self::GOLD_RATE, self::AI_REVIEW, self::ONE_REVIEW];

    public const LABELS = [
        self::WEBSITE => 'Website (subdomain)',
        self::VISITING_CARD => 'Digital visiting card',
        self::GOLD_RATE => 'Gold rate',
        self::AI_REVIEW => 'AI Google Review',
        self::ONE_REVIEW => 'One Review',
    ];

    public const BLURBS = [
        self::WEBSITE => 'Its own website on a subdomain, with slider, gallery and online shop.',
        self::VISITING_CARD => 'A digital visiting card with its link, QR code and PDF.',
        self::GOLD_RATE => "Today's gold-rate posters with its logo, ready to share.",
        self::AI_REVIEW => 'A review page where AI writes the review for customers to post on Google.',
        self::ONE_REVIEW => 'One QR code that opens all its review and social media links on one page.',
    ];

    // The Manage-page sections each feature brings.
    public const SECTIONS = [
        self::WEBSITE => ['Website', 'Slider', 'Our Gallery', 'Products', 'Orders', 'Customers'],
        self::VISITING_CARD => ['Visiting Card'],
        self::GOLD_RATE => ['Gold Rate'],
        self::AI_REVIEW => ['AI Google Review'],
        self::ONE_REVIEW => ['One Review'],
    ];

    public static function rules(): array
    {
        return [
            'features' => ['sometimes', 'array'],
            'features.*' => ['string', 'distinct', 'in:'.implode(',', self::ALL)],
        ];
    }

    /** The features a business has, in the standard order. */
    public static function of(Business|array $business): array
    {
        $raw = $business instanceof Business ? $business->features : ($business['features'] ?? null);

        return $raw === null ? self::ALL : self::clean($raw);
    }

    public static function has(Business|array $business, string $feature): bool
    {
        return in_array($feature, self::of($business), true);
    }

    public static function assert(Business $business, string $feature): void
    {
        if (! self::has($business, $feature)) {
            throw ApiException::forbidden('This business doesn’t have the '.mb_strtolower(self::LABELS[$feature]).'. Ask your dealer to add it.');
        }
    }

    /** Known features only, each once, in the standard order. */
    public static function clean(mixed $list): array
    {
        return is_array($list) ? array_values(array_intersect(self::ALL, $list)) : [];
    }

    /** Whether a Manage-page section is open to this business. */
    public static function allowsSection(Business|array $business, string $section): bool
    {
        foreach (self::SECTIONS as $feature => $sections) {
            if (in_array($section, $sections, true)) {
                return self::has($business, $feature);
            }
        }

        return true;
    }
}
