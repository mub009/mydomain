<?php

namespace App\Support;

use App\Models\FeaturePlan;

/**
 * Feature pricing, set by the admin, for each feature (BusinessFeatures):
 * - points / renewalPoints: what a dealer's balance is charged to add the
 *   feature, and for each renewal of a timed one;
 * - price / renewalPrice: prices in rupees, shown to dealers;
 * - commission / renewalCommission: the admin's share in rupees, which the
 *   dealer owes for each sale and renewal (recorded on the purchase);
 * - months: how long it lasts, 1, 3, 6 or 12, or unlimited (null).
 * A timed feature switches off on its end date until the dealer renews it
 * (Points::buyFeature). Changing a plan only affects features bought or
 * renewed after the change.
 */
class FeaturePlans
{
    /** The durations the admin can pick; null is unlimited. */
    public const DURATIONS = [null, 1, 3, 6, 12];

    public const MAX_POINTS = 1000;

    public const MAX_PRICE = 10000000;

    /** Rupee amounts in a plan, as stored => as presented. */
    public const MONEY = ['priceInr' => 'price', 'renewalPriceInr' => 'renewalPrice', 'commissionInr' => 'commission', 'renewalCommissionInr' => 'renewalCommission'];

    /** @return array<string, array{points: int, renewalPoints: int, price: ?int, renewalPrice: ?int, commission: ?int, renewalCommission: ?int, months: ?int}> */
    public static function all(): array
    {
        $rows = FeaturePlan::all()->keyBy('feature');

        return collect(BusinessFeatures::ALL)->mapWithKeys(function ($f) use ($rows) {
            $row = $rows[$f] ?? null;
            $plan = [
                'points' => (int) ($row->points ?? Points::PER_FEATURE),
                'renewalPoints' => (int) ($row->renewalPoints ?? $row->points ?? Points::PER_FEATURE),
                'months' => $row->durationMonths ?? null,
            ];
            foreach (self::MONEY as $column => $key) {
                $plan[$key] = $row?->{$column};
            }

            return [$f => $plan];
        })->all();
    }

    public static function plan(string $feature): array
    {
        return self::all()[$feature];
    }

    public static function points(string $feature): int
    {
        return self::plan($feature)['points'];
    }

    public static function renewalPoints(string $feature): int
    {
        return self::plan($feature)['renewalPoints'];
    }

    public static function months(string $feature): ?int
    {
        return self::plan($feature)['months'];
    }

    /** What these features cost together, to add or (with $renewal) to renew. */
    public static function cost(array $features, bool $renewal = false): int
    {
        return array_sum(array_map(fn ($f) => $renewal ? self::renewalPoints($f) : self::points($f), $features));
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

    public static function priceLabel(?int $price): ?string
    {
        return $price === null ? null : '₹'.number_format($price);
    }

    /** Admin: save every feature's plan at once. */
    public static function save(array $plans): void
    {
        foreach ($plans as $feature => $plan) {
            $values = [
                'points' => (int) $plan['points'],
                'renewalPoints' => (int) $plan['renewalPoints'],
                'durationMonths' => $plan['months'],
            ];
            foreach (self::MONEY as $column => $key) {
                $values[$column] = $plan[$key] ?? null;
            }
            FeaturePlan::updateOrCreate(['feature' => $feature], $values);
        }
    }

    /** For the admin tab and the dealer's pickers. */
    public static function present(): array
    {
        return collect(self::all())->map(function ($p, $f) {
            $out = ['feature' => $f, 'label' => BusinessFeatures::LABELS[$f], ...$p, 'duration' => self::durationLabel($p['months'])];
            foreach (self::MONEY as $key) {
                $out[$key.'Label'] = self::priceLabel($p[$key]);
            }

            return $out;
        })->values()->all();
    }
}
