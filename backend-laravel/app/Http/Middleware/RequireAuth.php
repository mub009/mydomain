<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Support\Jwt;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization');
        if (! $header || ! str_starts_with($header, 'Bearer ')) {
            throw ApiException::unauthorized('Missing bearer token');
        }

        $payload = Jwt::verifyAccessToken(substr($header, 7));
        if (! $payload) {
            throw ApiException::unauthorized('Invalid or expired token');
        }

        $request->attributes->set('auth', $payload);

        return $next($request);
    }
}
