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
}
