<?php

namespace App\Support;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\PointTransaction;
use App\Models\User;

// What a dealer pays: a point for each feature it gives a business
// (App\Support\BusinessFeatures) — the listing itself is free. Only dealers
// are charged; admins and self-registered owners pay nothing.
class Points
{
    public const PER_FEATURE = 1;

    public const OUT_OF_POINTS_MESSAGE = 'You don’t have enough points for these features. Please contact the admin to add more points to your account.';

    // Every type a dealer's spending on a business is recorded under; their
    // sum (negated) is what the dealer has paid for it, net of refunds.
    private const SPENDING_TYPES = ['BUSINESS_CREATED', 'FEATURE_ADDED', 'FEATURE_REMOVED'];

    /** Up front, before anything is created: whether the dealer can pay for $count features. */
    public static function assertCanAfford(array $actor, int $count): void
    {
        if ($actor['role'] !== 'DEALER' || $count <= 0) {
            return;
        }

        $dealer = User::find($actor['sub']);
        if (! $dealer) {
            throw ApiException::notFound('User not found');
        }
        if ($dealer->points < $count * self::PER_FEATURE) {
            throw ApiException::forbidden(self::OUT_OF_POINTS_MESSAGE);
        }
    }

    // A point for giving a business a feature. Must run inside the caller's
    // transaction so the change and the debit commit together.
    public static function spendForFeature(array $actor, string $businessId, string $feature): void
    {
        if ($actor['role'] !== 'DEALER') {
            return;
        }

        $dealer = User::where('id', $actor['sub'])->lockForUpdate()->first();
        if (! $dealer) {
            throw ApiException::notFound('User not found');
        }
        if ($dealer->points < self::PER_FEATURE) {
            throw ApiException::forbidden(self::OUT_OF_POINTS_MESSAGE);
        }

        $dealer->decrement('points', self::PER_FEATURE);

        PointTransaction::create([
            'userId' => $actor['sub'],
            'type' => 'FEATURE_ADDED',
            'amount' => -self::PER_FEATURE,
            'balanceAfter' => $dealer->points,
            'businessId' => $businessId,
            'feature' => $feature,
            'note' => BusinessFeatures::LABELS[$feature] ?? $feature,
        ]);
    }

    // Taking a feature away returns what the dealer paid for it, if anything
    // (a feature a listing had before features cost points was never paid
    // for). Inside the caller's transaction. Returns the points refunded.
    public static function refundFeature(array $actor, Business $business, string $feature): int
    {
        if ($actor['role'] !== 'DEALER') {
            return 0;
        }

        $paid = (int) -PointTransaction::where('userId', $actor['sub'])
            ->where('businessId', $business->id)
            ->where('feature', $feature)
            ->whereIn('type', ['FEATURE_ADDED', 'FEATURE_REMOVED'])
            ->sum('amount');
        $dealer = User::where('id', $actor['sub'])->lockForUpdate()->first();
        if ($paid <= 0 || ! $dealer) {
            return 0;
        }

        $dealer->increment('points', $paid);

        PointTransaction::create([
            'userId' => $actor['sub'],
            'type' => 'FEATURE_REMOVED',
            'amount' => $paid,
            'balanceAfter' => $dealer->points,
            'businessId' => $business->id,
            'feature' => $feature,
            'note' => (BusinessFeatures::LABELS[$feature] ?? $feature)." removed from “{$business->name}” — point returned",
        ]);

        return $paid;
    }

    // A dealer deleting a listing they paid for gets every point back, so a
    // listing made by mistake costs nothing. Only the dealer who was charged
    // is refunded, and only when they delete it themselves. Must run inside
    // the caller's transaction, before the business row goes. Returns the
    // points refunded.
    public static function refundForBusiness(array $actor, Business $business): int
    {
        if ($actor['role'] !== 'DEALER') {
            return 0;
        }

        $paid = (int) -PointTransaction::where('userId', $actor['sub'])
            ->where('businessId', $business->id)
            ->whereIn('type', self::SPENDING_TYPES)
            ->sum('amount');
        $dealer = User::where('id', $actor['sub'])->lockForUpdate()->first();
        if ($paid <= 0 || ! $dealer) {
            return 0;
        }

        $dealer->increment('points', $paid);

        PointTransaction::create([
            'userId' => $actor['sub'],
            'type' => 'BUSINESS_DELETED',
            'amount' => $paid,
            'balanceAfter' => $dealer->points,
            'businessId' => $business->id,
            'note' => "Deleted “{$business->name}” — ".($paid === 1 ? 'point' : "{$paid} points").' returned',
        ]);

        return $paid;
    }

    /** What a dealer has spent on businesses, net of refunds. */
    public static function totalSpent(string $userId): int
    {
        return (int) -PointTransaction::where('userId', $userId)
            ->whereIn('type', [...self::SPENDING_TYPES, 'BUSINESS_DELETED'])
            ->sum('amount');
    }

    // Admin adjusts a dealer's balance. A positive amount grants points, a
    // negative amount removes them (never below zero).
    public static function adjust(string $adminId, string $targetId, int $amount, ?string $note = null): User
    {
        if ($amount === 0) {
            throw ApiException::badRequest('Amount must not be zero');
        }

        $target = User::find($targetId);
        if (! $target) {
            throw ApiException::notFound('User not found');
        }
        if ($target->role !== 'DEALER') {
            throw ApiException::badRequest('Points can only be assigned to dealer accounts');
        }

        $balanceAfter = $target->points + $amount;
        if ($balanceAfter < 0) {
            throw ApiException::badRequest("Cannot deduct {$amount} points — the dealer only has {$target->points}");
        }

        $target->update(['points' => $balanceAfter]);
        PointTransaction::create([
            'userId' => $targetId,
            'type' => $amount > 0 ? 'ADMIN_GRANT' : 'ADMIN_DEDUCTION',
            'amount' => $amount,
            'balanceAfter' => $balanceAfter,
            'note' => $note,
            'grantedById' => $adminId,
        ]);

        return $target;
    }

    public static function listTransactions(string $userId, array $pagination): array
    {
        $query = PointTransaction::where('userId', $userId);
        $total = (clone $query)->count();
        $items = $query->orderByDesc('createdAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with('grantedBy:id,firstName,lastName,email')
            ->get();

        return [$items, $total];
    }
}
