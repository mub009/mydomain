<?php

namespace App\Support;

use App\Exceptions\ApiException;
use App\Models\Business;

/**
 * Who can manage a business beyond just reading its public listing.
 *
 * A dealer creating a listing on a client's behalf assigns it to a fresh
 * owner login (`ownerId`), not their own account — they're only recorded as
 * `createdById`. QrCodeController already treats that dealer as the
 * business's manager for QR boards; this centralises the same rule (admin,
 * the actual owner, or the creating dealer) so every controller that gates
 * business management enforces it identically instead of five near-copies
 * that can drift out of sync.
 */
class BusinessAccess
{
    public static function canManage(array $actor, Business $business): bool
    {
        if ($actor['role'] === 'ADMIN') {
            return true;
        }
        if ($actor['sub'] === $business->ownerId) {
            return true;
        }

        return $actor['role'] === 'DEALER' && $business->createdById && $actor['sub'] === $business->createdById;
    }

    public static function assertCanManage(array $actor, Business $business): void
    {
        if (! self::canManage($actor, $business)) {
            throw ApiException::forbidden('You do not own this business');
        }
    }
}
