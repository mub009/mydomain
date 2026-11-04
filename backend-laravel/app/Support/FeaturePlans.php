<?php

namespace App\Support;

use App\Models\FeaturePlan;

/**
 * Feature pricing, set by the admin: how many points a dealer pays for each
 * feature (BusinessFeatures) and how long it lasts — 1, 3, 6 or 12 months,
 * or unlimited. A timed feature switches off on its end date until the
 * dealer renews it, paying the same points again (Points::buyFeature).
 * Changing a plan only affects features bought or renewed after the change.
 */
class FeaturePlans
{
    /** The durations the admin can pick; null is unlimited. */
    public const DURATIONS = [null, 1, 3, 6, 12];

    public const MAX_POINTS = 1000;

    /** @return array<string, array{points: int, months: ?int}> every feature's plan, in the standard order */
    public static function all(): array
    {
        $rows = FeaturePlan::all()->keyBy('feature');

        return collect(BusinessFeatures::ALL)->mapWithKeys(fn ($f) => [$f => [
            'points' => (int) ($rows[$f]->points ?? Points::PER_FEATURE),
            'months' => $rows[$f]->durationMonths ?? null,
        ]])->all();
    }

    public static function points(string $feature): int
    {
        return self::all()[$feature]['points'] ?? Points::PER_FEATURE;
    }

    public static function months(string $feature): ?int
    {
        return self::all()[$feature]['months'] ?? null;
    }

    /** What these features cost together. */
    public static function cost(array $features): int
    {
        return array_sum(array_map(fn ($f) => self::points($f), $features));
    }

    public static function durationLabel(?int $months): string
    {
        return match ($months) {
            null => 'Unlimited',
            1 => '1 month',
            12 => '1 year',
            default => "{$months} months",
        };
    }

    /** Admin: save every feature's plan at once. */
    public static function save(array $plans): void
    {
        foreach ($plans as $feature => $plan) {
            FeaturePlan::updateOrCreate(['feature' => $feature], ['points' => (int) $plan['points'], 'durationMonths' => $plan['months']]);
        }
    }

    /** For the admin tab and the dealer's pickers. */
    public static function present(): array
    {
        return collect(self::all())->map(fn ($p, $f) => [
            'feature' => $f,
            'label' => BusinessFeatures::LABELS[$f],
            'points' => $p['points'],
            'months' => $p['months'],
            'duration' => self::durationLabel($p['months']),
        ])->values()->all();
    }
}
