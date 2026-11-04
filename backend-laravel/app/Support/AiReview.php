<?php

namespace App\Support;

use App\Exceptions\ApiException;
use App\Models\AiReviewDraft;
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
 * businesses.aiReview holds the business's settings — what the reviews may
 * mention and how they read:
 * { highlights, languages, tone, length, keywords, avoid, staff, emoji }.
 *
 * Every draft is unique: it is compared with the business's recent drafts
 * (ai_review_drafts) and written again when it reads too much like one.
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

    // How the reviews sound. "mixed" picks a different one of these each time.
    public const TONES = [
        'mixed' => 'Varied (a different style each time)',
        'friendly' => 'Friendly and warm',
        'professional' => 'Professional and polished',
        'enthusiastic' => 'Enthusiastic',
        'simple' => 'Simple and short sentences',
    ];

    private const TONE_STYLES = [
        'friendly' => ['warm and friendly, about how the visit felt', 'friendly and personal, like telling a friend about it'],
        'professional' => ['polished and professional, focused on the quality of the service', 'measured and professional, like a considered recommendation'],
        'enthusiastic' => ['enthusiastic and upbeat, clearly delighted', 'excited and energetic, eager to recommend it'],
        'simple' => ['simple and to the point, in short plain sentences', 'plain and brief, like a quick note'],
    ];

    // A different angle each time, so two customers rarely get the same review.
    private const STYLES = [
        'short and casual, like a quick note from a regular customer',
        'warm and friendly, about how the visit felt',
        'focused on one service they used',
        'simple and to the point, recommending it to others',
        'about the people and the service they got',
        'like a first-time visitor who will come back',
        'about the moment they walked in and how they were looked after',
        'comparing it favourably with what they expected',
        'practical, about what they came for and how it went',
    ];

    // label, minimum words, maximum words
    public const LENGTHS = [
        'short' => ['Short (15–35 words)', 15, 35],
        'medium' => ['Medium (30–70 words)', 30, 70],
        'long' => ['Long (60–110 words)', 60, 110],
    ];

    public const DEFAULTS = [
        'highlights' => '', 'languages' => ['en'], 'tone' => 'mixed', 'length' => 'medium',
        'keywords' => '', 'avoid' => '', 'staff' => '', 'emoji' => false,
    ];

    // How many recent drafts a new one is compared with, and how many are kept.
    private const COMPARE_WITH = 150;

    private const KEEP = 300;

    // Word-trigram overlap above which a draft counts as a repeat.
    public const SIMILAR = 0.35;

    private const ATTEMPTS = 3;

    // A customer waits for the review: the AI gets this long in all (seconds),
    // then the built-in writer finishes the job at once.
    private const TIME_BUDGET = 15;

    public static function rules(): array
    {
        return [
            'highlights' => ['sometimes', 'nullable', 'string', 'max:300'],
            'languages' => ['sometimes', 'array', 'min:1'],
            'languages.*' => ['string', 'distinct', 'in:'.implode(',', array_keys(self::LANGUAGES))],
            'tone' => ['sometimes', 'string', 'in:'.implode(',', array_keys(self::TONES))],
            'length' => ['sometimes', 'string', 'in:'.implode(',', array_keys(self::LENGTHS))],
            'keywords' => ['sometimes', 'nullable', 'string', 'max:300'],
            'avoid' => ['sometimes', 'nullable', 'string', 'max:300'],
            'staff' => ['sometimes', 'nullable', 'string', 'max:200'],
            'emoji' => ['sometimes', 'boolean'],
        ];
    }

    /** The business's settings, with defaults filled in and unknown values dropped. */
    public static function settings(Business $business): array
    {
        $raw = is_array($business->aiReview) ? $business->aiReview : [];
        $languages = array_values(array_intersect(array_keys(self::LANGUAGES), (array) ($raw['languages'] ?? [])));
        $text = fn (string $key) => trim((string) ($raw[$key] ?? ''));

        return [
            'highlights' => $text('highlights'),
            'languages' => $languages ?: self::DEFAULTS['languages'],
            'tone' => isset(self::TONES[$raw['tone'] ?? null]) ? $raw['tone'] : self::DEFAULTS['tone'],
            'length' => isset(self::LENGTHS[$raw['length'] ?? null]) ? $raw['length'] : self::DEFAULTS['length'],
            'keywords' => $text('keywords'),
            'avoid' => $text('avoid'),
            'staff' => $text('staff'),
            'emoji' => (bool) ($raw['emoji'] ?? false),
        ];
    }

    /** A comma- or line-separated setting as a clean list. */
    public static function list(string $value): array
    {
        return collect(preg_split('/[,\n;]+/u', $value))->map(fn ($v) => trim($v))->filter()->unique()->values()->all();
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

    /** How many drafts are remembered for the uniqueness check. */
    public static function draftCount(Business $business): int
    {
        return AiReviewDraft::where('businessId', $business->id)->count();
    }

    /**
     * A fresh, unique review for this business, by the AI (or the built-in
     * writer), following the business's settings. A draft that repeats a
     * recent one, or uses a word the business wants avoided, is written
     * again (up to ATTEMPTS times; the most different one is kept).
     *
     * @return array{review: string, source: string, unique: bool}
     */
    public static function write(Business $business, int $rating, string $language, bool $remember = true): array
    {
        $settings = self::settings($business);
        if (! in_array($language, $settings['languages'], true)) {
            throw ApiException::badRequest('That language is not offered for this business');
        }
        $business->loadMissing('category');
        $rating = max(1, min(5, $rating));
        $services = $business->services()->where('isActive', true)->pluck('name')->shuffle()->all();
        $recent = AiReviewDraft::where('businessId', $business->id)->orderByDesc('createdAt')->orderByDesc('id')
            ->limit(self::COMPARE_WITH)->pluck('text')->all();
        $recentShingles = array_map(fn ($t) => self::shingles($t), $recent);
        $avoid = self::list($settings['avoid']);
        $keywords = self::list($settings['keywords']);
        $staff = self::list($settings['staff']);
        [, $minWords, $maxWords] = self::LENGTHS[$settings['length']];

        $best = null;
        $started = microtime(true);
        for ($attempt = 0; $attempt < self::ATTEMPTS; $attempt++) {
            $facts = [
                'name' => $business->name,
                'category' => $business->category?->name,
                'city' => $business->city,
                'services' => $services,
                'highlights' => $settings['highlights'] ?: null,
                // One keyword and maybe one staff name per review, so they're spread out.
                'keyword' => $keywords ? $keywords[array_rand($keywords)] : null,
                'staff' => $staff && random_int(0, 1) ? $staff[array_rand($staff)] : null,
                'avoid' => $avoid,
                'emoji' => $settings['emoji'],
                'minWords' => $minWords,
                'maxWords' => $maxWords,
                // How recent reviews began, so this one starts differently.
                'avoidOpenings' => array_slice(array_map(fn ($t) => self::opening($t), $recent), 0, 8),
            ];
            $left = (int) floor(self::TIME_BUDGET - (microtime(true) - $started));
            $draft = AiWriter::googleReview($facts, $rating, self::LANGUAGES[$language][0], self::style($settings['tone']), min(12, $left));
            $draft['review'] = self::tidy($draft['review'], $settings['emoji']);

            $similarity = self::maxSimilarity($draft['review'], $recentShingles);
            $penalty = self::usesAvoided($draft['review'], $avoid) ? 1.0 : 0.0;
            $score = max($similarity, $penalty);
            if (! $best || $score < $best['score']) {
                $best = [...$draft, 'score' => $score];
            }
            if ($score < self::SIMILAR) {
                break;
            }
        }

        if ($remember) {
            self::remember($business, $best['review']);
        }

        return ['review' => $best['review'], 'source' => $best['source'], 'unique' => $best['score'] < self::SIMILAR];
    }

    private static function style(string $tone): string
    {
        $angle = self::STYLES[array_rand(self::STYLES)];
        $options = self::TONE_STYLES[$tone] ?? null;

        // A chosen tone, plus a varying angle so reviews still differ.
        return $options ? $options[array_rand($options)].'; '.$angle : $angle;
    }

    // --- Uniqueness ---------------------------------------------------------------

    private static function normalise(string $text): string
    {
        return trim(preg_replace('/\s+/u', ' ', preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', mb_strtolower($text))));
    }

    /** The text's word trigrams. */
    public static function shingles(string $text): array
    {
        $words = explode(' ', self::normalise($text));
        if (count($words) < 3) {
            return [implode(' ', $words) => true];
        }
        $out = [];
        for ($i = 0; $i + 2 < count($words); $i++) {
            $out[$words[$i].' '.$words[$i + 1].' '.$words[$i + 2]] = true;
        }

        return $out;
    }

    /** Overlap (Jaccard) of two texts' trigrams: 0 is nothing in common, 1 the same. */
    public static function similarity(string $a, string $b): float
    {
        return self::jaccard(self::shingles($a), self::shingles($b));
    }

    private static function jaccard(array $a, array $b): float
    {
        if (! $a || ! $b) {
            return 0.0;
        }
        $common = count(array_intersect_key($a, $b));

        return $common / (count($a) + count($b) - $common);
    }

    private static function maxSimilarity(string $text, array $recentShingles): float
    {
        $mine = self::shingles($text);
        $max = 0.0;
        foreach ($recentShingles as $other) {
            $max = max($max, self::jaccard($mine, $other));
        }

        return $max;
    }

    private static function opening(string $text): string
    {
        return implode(' ', array_slice(preg_split('/\s+/u', trim($text)), 0, 5));
    }

    private static function usesAvoided(string $text, array $avoid): bool
    {
        $lower = mb_strtolower($text);
        foreach ($avoid as $word) {
            if ($word !== '' && str_contains($lower, mb_strtolower($word))) {
                return true;
            }
        }

        return false;
    }

    /** One line of clean text; emoji removed unless the business allows them. */
    private static function tidy(string $text, bool $emoji): string
    {
        if (! $emoji) {
            $text = preg_replace('/[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{FE0F}\x{200D}]/u', '', $text);
        }

        return trim(preg_replace('/[ \t]+/u', ' ', $text));
    }

    private static function remember(Business $business, string $text): void
    {
        AiReviewDraft::create(['businessId' => $business->id, 'text' => $text, 'fingerprint' => sha1(self::normalise($text))]);
        // Keep only the latest KEEP.
        $cutoff = AiReviewDraft::where('businessId', $business->id)->orderByDesc('id')->skip(self::KEEP)->value('id');
        if ($cutoff) {
            AiReviewDraft::where('businessId', $business->id)->where('id', '<=', $cutoff)->delete();
        }
    }

    // --- The built-in writer ------------------------------------------------------

    /**
     * The free, offline writer (English), used when no AI service is set
     * up or it fails. It puts a review together from an opening, a line
     * about one service or point, an optional keyword or staff line and a
     * closing, each picked from many, so drafts rarely repeat.
     */
    public static function builtin(array $facts, int $rating): string
    {
        $name = $facts['name'];
        $what = mb_strtolower(trim((string) ($facts['category'] ?? ''))) ?: 'place';
        $points = collect(self::list((string) ($facts['highlights'] ?? '')))->merge($facts['services'] ?? [])->filter()->values();
        $point = $points->isNotEmpty() ? mb_strtolower($points->random()) : null;
        // Never a phrase with a word the business wants avoided, while there's another to choose.
        $avoid = $facts['avoid'] ?? [];
        $pick = function (array $options) use ($avoid) {
            $allowed = array_values(array_filter($options, fn ($o) => ! self::usesAvoided($o, $avoid)));
            $from = $allowed ?: $options;

            return $from[array_rand($from)];
        };
        $band = $rating >= 5 ? 5 : ($rating === 4 ? 4 : ($rating === 3 ? 3 : 1));

        $openings = [
            5 => ["Had a really good experience at {$name}.", "Very happy with my visit to {$name}.", "{$name} exceeded what I expected.", "Such a pleasant visit to {$name}.",
                "Really impressed with {$name}.", "Wonderful experience at {$name} today.", "Glad I chose {$name}.", "Everything went smoothly at {$name}.", "Thoroughly enjoyed my time at {$name}."],
            4 => ["Good experience at {$name}.", "Pleased with my visit to {$name}.", "A nice {$what} overall.", "Happy with how things went at {$name}.", "Solid experience at {$name}."],
            3 => ["Decent experience at {$name}.", "An average visit to {$name}.", "Mixed feelings about my visit to {$name}.", "My visit to {$name} was okay."],
            1 => ["My visit to {$name} did not go as I hoped.", "Not the experience I was expecting at {$name}.", "I was a little disappointed with {$name} this time."],
        ];
        $pointLines = [
            5 => ['The %s was excellent.', 'Loved the %s.', 'Their %s is really worth it.', 'The %s was done really well.', 'I was very happy with the %s.', 'The %s stood out for me.'],
            4 => ['The %s was nice.', 'I liked the %s.', 'The %s was good.', 'Happy with the %s.'],
            3 => ['The %s was fine.', 'The %s was okay.', 'The %s could be a little better.'],
            1 => ['I expected more from the %s.', 'The %s was not up to the mark.', 'The %s needs attention.'],
        ];
        $middles = [
            5 => ['The staff were welcoming and helpful.', 'Friendly people and quick service.', 'Everything was well organised.', 'They really took care of me.', 'The service was prompt and courteous.', 'Clean, comfortable and well run.'],
            4 => ['Service was friendly and quick.', 'The staff were polite.', 'A few small things could be better.', 'Mostly smooth from start to finish.'],
            3 => ['Some things were good, some could be improved.', 'The staff were polite, but it was slow.', 'It met my basic needs.'],
            1 => ['The service needs some attention.', 'It took longer than it should have.', 'Communication could have been better.'],
        ];
        $closings = [
            5 => ['Highly recommended!', 'Will definitely come back.', 'I would recommend it to friends and family.', 'Keep up the good work!', 'Worth every visit.', 'Five stars from me.', 'My go-to place from now on.'],
            4 => ['Will visit again.', 'Worth a visit.', 'I would recommend it.', 'Overall a good experience.'],
            3 => ['Hope to see it get better.', 'Might try again.', 'There is room to improve.'],
            1 => ['I hope they look into this.', 'Hoping things improve.', 'I hope my next visit is better.'],
        ];

        $parts = [$pick($openings[$band])];
        if ($point) {
            $parts[] = sprintf($pick($pointLines[$band]), $point);
        }
        if (! empty($facts['staff']) && $band >= 4) {
            $parts[] = $pick(["{$facts['staff']} was very helpful.", "Special thanks to {$facts['staff']}.", "{$facts['staff']} looked after me well."]);
        }
        $parts[] = $pick($middles[$band]);
        if (! empty($facts['keyword']) && $band >= 4) {
            $parts[] = $pick(["If you are looking for {$facts['keyword']}, this is a great choice.", "A good option for {$facts['keyword']}.", "Recommended for anyone searching for {$facts['keyword']}."]);
        }
        // Long reviews get another line; short ones lose the middle.
        $max = (int) ($facts['maxWords'] ?? 70);
        if ($max >= 100) {
            $parts[] = $pick($middles[$band]);
        }
        $parts[] = $pick($closings[$band]);
        $text = implode(' ', array_unique($parts));
        if ($max <= 35 && str_word_count($text) > $max) {
            $text = $parts[0].' '.end($parts);
        }

        return trim(preg_replace('/\s+/', ' ', $text));
    }
}
