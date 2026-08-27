<?php

namespace App\Support;

// Dealer privileges — feature grants an admin can toggle per dealer.
// Business owners and admins implicitly have every privilege on the
// resources they own; only DEALER accounts are gated by this list.
class Privileges
{
    public const ALL = ['MANAGE_LISTINGS', 'MANAGE_LEADS', 'MANAGE_BOOKINGS'];

    public const DEFAULT_DEALER = ['MANAGE_LISTINGS'];

    public static function normalize(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        return array_values(array_filter($raw, fn ($v) => is_string($v) && in_array($v, self::ALL, true)));
    }

    public static function has(string $role, mixed $privileges, string $needed): bool
    {
        if ($role !== 'DEALER') {
            return true;
        }

        return in_array($needed, self::normalize($privileges), true);
    }
}
