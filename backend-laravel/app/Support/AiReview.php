<?php

namespace App\Support;

use App\Exceptions\ApiException;
use App\Models\Business;

/**
 * AI Google Review (a feature the dealer gives the business,
 * BusinessFeatures::AI_REVIEW): a page at /review/<slug>, opened from a QR
 * code or a shared link, where the AI drafts a Google review for the
 * customer as soon as it opens. The customer picks their stars and
 * language, can rewrite or edit the draft, then copies it and is sent
 * to the business's Google "write a review" page to paste and post it.
 *
 * Every rating gets a review in its own tone. Customers aren't filtered by
 * rating before they reach Google, which Google's review policy forbids.
 *
 * businesses.aiReview holds the business's settings:
 * { highlights: what reviews may mention, languages: codes offered }.
 */
class AiReview
{
    public const LANGUAGES = [
        'en' => ['English', 'English'],
        'ml' => ['Malayalam', 'മലയാളം'],
        'hi' => ['Hindi', 'हिन्दी'],
        'ta' => ['Tamil', 'தமிழ்'],
        'kn' => ['Kannada', 'ಕನ್ನಡ'],
        'te' => ['Telugu', 'తెలుగు'],
        'mr' => ['Marathi', 'मराठी'],
        'ar' => ['Arabic', 'العربية'],
    ];

    public const DEFAULTS = ['highlights' => '', 'languages' => ['en']];

    // A different angle each time, so two customers rarely get the same review.
    private const STYLES = [
        'short and casual, like a quick note from a regular customer',
        'warm and friendly, about how the visit felt',
        'focused on one service they used',
        'simple and to the point, recommending it to others',
        'about the people and the service they got',
        'like a first-time visitor who will come back',
    ];

    public static function rules(): array
    {
        return [
            'highlights' => ['sometimes', 'nullable', 'string', 'max:300'],
            'languages' => ['sometimes', 'array', 'min:1'],
            'languages.*' => ['string', 'distinct', 'in:'.implode(',', array_keys(self::LANGUAGES))],
        ];
    }

    /** The business's settings, with defaults filled in and unknown values dropped. */
    public static function settings(Business $business): array
    {
        $raw = is_array($business->aiReview) ? $business->aiReview : [];
        $languages = array_values(array_intersect(array_keys(self::LANGUAGES), (array) ($raw['languages'] ?? [])));

        return [
            'highlights' => trim((string) ($raw['highlights'] ?? '')),
            'languages' => $languages ?: self::DEFAULTS['languages'],
        ];
    }

    public static function url(Business $business): string
    {
        return rtrim((string) config('app.url'), '/')."/review/{$business->slug}";
    }

    /** The public page is up while the listing is live, has the feature and a Google review link. */
    public static function live(Business $business): bool
    {
        return $business->status === 'PUBLISHED'
            && BusinessFeatures::has($business, BusinessFeatures::AI_REVIEW)
            && ReviewChannels::google($business) !== null;
    }

    /**
     * A fresh review for this business, by the AI (or the built-in writer).
     *
     * @return array{review: string, source: string}
     */
    public static function write(Business $business, int $rating, string $language): array
    {
        $settings = self::settings($business);
        if (! in_array($language, $settings['languages'], true)) {
            throw ApiException::badRequest('That language is not offered for this business');
        }
        $business->loadMissing('category');
        $services = $business->services()->where('isActive', true)->pluck('name')->shuffle()->all();

        return AiWriter::googleReview([
            'name' => $business->name,
            'category' => $business->category?->name,
            'city' => $business->city,
            'services' => $services,
            'highlights' => $settings['highlights'] ?: null,
        ], max(1, min(5, $rating)), self::LANGUAGES[$language][0], self::STYLES[array_rand(self::STYLES)]);
    }

    /**
     * The free, offline writer (English), used when no AI service is set
     * up or it fails: a review from phrases matched to the rating, naming
     * one service or point the business gave.
     */
    public static function builtin(array $facts, int $rating): string
    {
        $name = $facts['name'];
        $what = mb_strtolower(trim((string) ($facts['category'] ?? ''))) ?: 'place';
        $points = collect(preg_split('/[,\n;]+/', (string) ($facts['highlights'] ?? '')))->map(fn ($p) => trim($p))->filter()
            ->merge($facts['services'] ?? [])->filter()->values();
        $point = $points->isNotEmpty() ? mb_strtolower($points->random()) : null;
        $pick = fn (array $options) => $options[array_rand($options)];

        $text = match (true) {
            $rating >= 5 => $pick([
                "Had a really good experience at {$name}. ".($point ? "The {$point} was excellent. " : '').'Friendly people, good service and everything was well taken care of. Highly recommended!',
                "One of the nicest {$what}s I have visited. ".($point ? "Loved the {$point}. " : '').'The staff were welcoming and made the whole visit easy. Will definitely come back.',
                "Very happy with {$name}. ".($point ? "Their {$point} is worth it. " : '').'Good quality, quick service and a pleasant place. I would recommend it to my friends and family.',
                'Great service from start to finish. '.($point ? "Really liked the {$point}. " : '')."Everyone was polite and helpful. {$name} is now my go-to {$what}.",
            ]),
            $rating === 4 => $pick([
                "Good experience at {$name}. ".($point ? "The {$point} was nice. " : '').'Service was friendly and quick. A few small things could be better, but overall I am happy and will visit again.',
                "Nice {$what} with helpful staff. ".($point ? "I liked the {$point}. " : '').'Worth a visit, and I would recommend it.',
            ]),
            $rating === 3 => $pick([
                "Decent experience at {$name}. ".($point ? "The {$point} was okay. " : '').'Some things were good, some could be improved. Hope to see it get better.',
                "An average visit overall. The staff were polite, but the service could be quicker. ".($point ? "The {$point} was fine." : ''),
            ]),
            default => $pick([
                "My visit to {$name} did not go as I hoped. ".($point ? "I expected more from the {$point}. " : '').'I hope they look into this and improve.',
                "Not the experience I was expecting this time. The service needs some attention. I hope things improve.",
            ]),
        };

        return trim(preg_replace('/\s+/', ' ', $text));
    }
}
