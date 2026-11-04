<?php

namespace App\Support;

use App\Models\FeaturePlan;
use App\Models\PricingGroup;
use App\Models\User;

/**
 * Feature pricing, set by the admin per pricing group (PricingGroup). Each
 * dealer is in one group (users.pricingGroupId); a dealer in none pays the
 * default group's prices. For each feature (BusinessFeatures):
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

    // --- Groups ----------------------------------------------------------------

    /** The default group, made if somehow missing. */
    public static function defaultGroup(): PricingGroup
    {
        $group = PricingGroup::where('isDefault', true)->first();
        if ($group) {
            return $group;
        }
        $group = PricingGroup::query()->orderBy('createdAt')->first();
        if ($group) {
            $group->update(['isDefault' => true]);

            return $group;
        }

        return PricingGroup::create(['name' => 'Default', 'isDefault' => true]);
    }

    /** The group whose prices this dealer pays: theirs, or the default. */
    public static function groupIdFor(?string $userId): string
    {
        $groupId = $userId ? User::whereKey($userId)->value('pricingGroupId') : null;
        if ($groupId && PricingGroup::whereKey($groupId)->exists()) {
            return $groupId;
        }

        return self::defaultGroup()->id;
    }

    // --- Plans -----------------------------------------------------------------

    /**
     * Every feature's plan in a group (the default when null), in the
     * standard order. A feature the group has no row for falls back to the
     * default group's, then to a point and unlimited.
     *
     * @return array<string, array{points: int, renewalPoints: int, price: ?int, renewalPrice: ?int, commission: ?int, renewalCommission: ?int, months: ?int}>
     */
    public static function all(?string $groupId = null): array
    {
        $defaultId = self::defaultGroup()->id;
        $groupId ??= $defaultId;
        $rows = FeaturePlan::whereIn('groupId', array_unique([$groupId, $defaultId]))->get();
        $own = $rows->where('groupId', $groupId)->keyBy('feature');
        $fallback = $rows->where('groupId', $defaultId)->keyBy('feature');

        return collect(BusinessFeatures::ALL)->mapWithKeys(function ($f) use ($own, $fallback) {
            $row = $own[$f] ?? $fallback[$f] ?? null;
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

    /** The plans a dealer pays. */
    public static function forUser(?string $userId): array
    {
        return self::all(self::groupIdFor($userId));
    }

    public static function plan(string $feature, ?string $groupId = null): array
    {
        return self::all($groupId)[$feature];
    }

    /** What these features cost together in a group, to add or (with $renewal) to renew. */
    public static function cost(array $features, bool $renewal = false, ?string $groupId = null): int
    {
        $plans = self::all($groupId);

        return array_sum(array_map(fn ($f) => $renewal ? $plans[$f]['renewalPoints'] : $plans[$f]['points'], $features));
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

    /** Admin: save every feature's plan in a group at once. */
    public static function save(string $groupId, array $plans): void
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
            FeaturePlan::updateOrCreate(['groupId' => $groupId, 'feature' => $feature], $values);
        }
    }

    /** Copies one group's plans into another (a new group starts as a copy). */
    public static function copy(string $fromGroupId, string $toGroupId): void
    {
        $plans = [];
        foreach (self::all($fromGroupId) as $feature => $plan) {
            $plans[$feature] = $plan;
        }
        self::save($toGroupId, $plans);
    }

    /** For the admin tab and the dealer's pickers. */
    public static function present(?string $groupId = null): array
    {
        return collect(self::all($groupId))->map(function ($p, $f) {
            $out = ['feature' => $f, 'label' => BusinessFeatures::LABELS[$f], ...$p, 'duration' => self::durationLabel($p['months'])];
            foreach (self::MONEY as $key) {
                $out[$key.'Label'] = self::priceLabel($p[$key]);
            }

            return $out;
        })->values()->all();
    }
}
