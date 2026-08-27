<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $auth = $request->attributes->get('auth');
        if (! $auth) {
            throw ApiException::unauthorized();
        }
        if (! in_array($auth['role'], $roles, true)) {
            throw ApiException::forbidden('Insufficient permissions');
        }

        return $next($request);
    }
}
