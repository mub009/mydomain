<?php

namespace App\Http\Middleware;

use App\Support\WebAuth;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Blade-page counterpart of RequireAuth + RequireRole: a signed-out visitor
// goes to the login page, a signed-in one without the role goes home.
class WebRequireRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = WebAuth::user();
        if (! $user) {
            return redirect()->guest('/login');
        }
        if ($roles && ! in_array($user->role, $roles, true)) {
            return redirect('/');
        }

        return $next($request);
    }
}
