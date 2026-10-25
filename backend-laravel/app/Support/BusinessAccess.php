<?php

namespace App\Support;

use App\Exceptions\ApiException;
use App\Models\Business;

// Who may open and edit a business: admins, its owner, and the dealer who
// created it. A dealer keeps that access after handing the listing to the
// business team's own login, so they can keep its details up to date.
class BusinessAccess
{
    public static function canManage(array $actor, Business $business): bool
    {
        if ($actor['role'] === 'ADMIN' || $business->ownerId === $actor['sub']) {
            return true;
        }

        return $actor['role'] === 'DEALER' && $business->createdById === $actor['sub'];
    }

    public static function assertCanManage(array $actor, Business $business): void
    {
        if (! self::canManage($actor, $business)) {
            throw ApiException::forbidden('You do not manage this business');
        }
    }
}
