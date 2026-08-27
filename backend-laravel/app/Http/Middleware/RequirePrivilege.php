<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Models\User;
use App\Support\Privileges;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Gate a route on a dealer privilege. Non-dealer roles pass straight
// through (their access is governed by role + ownership checks); only
// DEALER accounts must hold the named privilege, which is read live from
// the database so admin changes take effect without re-login.
class RequirePrivilege
{
    public function handle(Request $request, Closure $next, string $privilege): Response
    {
        $auth = $request->attributes->get('auth');
        if (! $auth) {
            throw ApiException::unauthorized();
        }

        if ($auth['role'] !== 'DEALER') {
            return $next($request);
        }

        $user = User::find($auth['sub']);
        if (! Privileges::has('DEALER', $user?->privileges, $privilege)) {
            throw ApiException::forbidden("Your account doesn't have permission for this action");
        }

        return $next($request);
    }
}
