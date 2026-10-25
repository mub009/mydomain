<?php

namespace App\Support;

use App\Models\User;

/**
 * The signed-in user for the Blade pages. The API stays on bearer JWTs;
 * the web side keeps the user's id in the Laravel session instead, and
 * page scripts that call the API get a short-lived access token for that
 * user from /session/token.
 */
class WebAuth
{
    private const KEY = 'auth_user_id';

    // The resolved user is remembered on the request, never statically, so
    // nothing leaks from one request to the next in a long-lived process.
    private const ATTRIBUTE = 'webAuthUser';

    public static function user(): ?User
    {
        $attributes = request()->attributes;
        if ($attributes->has(self::ATTRIBUTE)) {
            return $attributes->get(self::ATTRIBUTE);
        }

        $id = session(self::KEY);
        $user = $id ? User::find($id) : null;
        // A suspended account loses its session on the next request.
        $user = $user && $user->status !== 'SUSPENDED' ? $user : null;
        $attributes->set(self::ATTRIBUTE, $user);

        return $user;
    }

    public static function login(User $user): void
    {
        session()->regenerate();
        session([self::KEY => $user->id]);
        request()->attributes->set(self::ATTRIBUTE, $user);
    }

    public static function logout(): void
    {
        session()->forget(self::KEY);
        session()->invalidate();
        session()->regenerateToken();
        request()->attributes->set(self::ATTRIBUTE, null);
    }

    public static function hasRole(string ...$roles): bool
    {
        $user = self::user();

        return $user !== null && in_array($user->role, $roles, true);
    }
}
