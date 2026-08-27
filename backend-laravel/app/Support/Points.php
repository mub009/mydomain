<?php

namespace App\Support;

use App\Exceptions\ApiException;
use App\Models\PointTransaction;
use App\Models\User;

// What registering one business costs a dealer. Only dealers are charged —
// admins and self-registered owners register listings for free.
class Points
{
    public const PER_BUSINESS = 1;

    public const OUT_OF_POINTS_MESSAGE = 'You have no points left to register a business. Please contact the admin to add more points to your account.';

    public static function assertHasPointsForBusiness(array $actor): void
    {
        if ($actor['role'] !== 'DEALER') {
            return;
        }

        $dealer = User::find($actor['sub']);
        if (! $dealer) {
            throw ApiException::notFound('User not found');
        }
        if ($dealer->points < self::PER_BUSINESS) {
            throw ApiException::forbidden(self::OUT_OF_POINTS_MESSAGE);
        }
    }

    // Must run inside the caller's transaction so the listing and the debit
    // commit together.
    public static function spendForBusiness(array $actor, string $businessId): void
    {
        if ($actor['role'] !== 'DEALER') {
            return;
        }

        $dealer = User::where('id', $actor['sub'])->lockForUpdate()->first();
        if (! $dealer) {
            throw ApiException::notFound('User not found');
        }
        if ($dealer->points < self::PER_BUSINESS) {
            throw ApiException::forbidden(self::OUT_OF_POINTS_MESSAGE);
        }

        $dealer->decrement('points', self::PER_BUSINESS);

        PointTransaction::create([
            'userId' => $actor['sub'],
            'type' => 'BUSINESS_CREATED',
            'amount' => -self::PER_BUSINESS,
            'balanceAfter' => $dealer->points,
            'businessId' => $businessId,
            'note' => 'Business registration',
        ]);
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
