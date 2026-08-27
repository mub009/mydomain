<?php

namespace App\Http\Middleware;

use App\Support\Jwt;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class OptionalAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization');
        if ($header && str_starts_with($header, 'Bearer ')) {
            $payload = Jwt::verifyAccessToken(substr($header, 7));
            if ($payload) {
                $request->attributes->set('auth', $payload);
            }
        }

        return $next($request);
    }
}
