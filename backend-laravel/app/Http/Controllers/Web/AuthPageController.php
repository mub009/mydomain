<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Jwt;
use App\Support\WebAuth;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

// Session sign-in for the Blade pages — same rules as the API's
// AuthController, but the result is a session instead of a token pair.
class AuthPageController extends Controller
{
    /**
     * Only same-site paths are honoured, so a crafted `?next=` cannot bounce
     * a freshly signed-in user off to another host. Protocol-relative values
     * ("//evil.test") are rejected along with anything not starting with "/".
     */
    private function safeNext(?string $raw): ?string
    {
        if (! $raw || ! str_starts_with($raw, '/') || str_starts_with($raw, '//')) {
            return null;
        }

        return $raw;
    }

    // Where someone lands after signing in when nothing sent them to log in
    // mid-task: their own workspace, or the directory for a customer.
    private static function homeFor(User $user): string
    {
        return match ($user->role) {
            'ADMIN' => '/admin',
            'DEALER', 'BUSINESS_OWNER' => '/dashboard',
            default => '/',
        };
    }

    public function showLogin(Request $request)
    {
        if ($user = WebAuth::user()) {
            return redirect($this->safeNext($request->query('next')) ?? self::homeFor($user));
        }

        // Where to return to — set by flows that send people here mid-task,
        // such as a review QR scanned by someone who is not signed in, or a
        // dashboard link followed while signed out.
        $next = $request->query('next');
        if (! $next && ($intended = session('url.intended'))) {
            $path = parse_url($intended, PHP_URL_PATH) ?: '/';
            $query = parse_url($intended, PHP_URL_QUERY);
            $next = $query ? "{$path}?{$query}" : $path;
        }

        return view('pages.login', ['next' => $this->safeNext(is_string($next) ? $next : null)]);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            // Email or mobile number — business logins can use either.
            'email' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:1'],
            'next' => ['nullable', 'string'],
        ]);

        $user = User::findByLogin($data['email']);
        if (! $user || ! Hash::check($data['password'], $user->passwordHash)) {
            throw ValidationException::withMessages(['email' => 'Invalid username or password']);
        }
        if ($user->status === 'SUSPENDED') {
            throw ValidationException::withMessages(['email' => 'Account suspended']);
        }

        WebAuth::login($user);
        session()->forget('url.intended');

        return redirect($this->safeNext($data['next'] ?? null) ?? self::homeFor($user));
    }

    public function showRegister()
    {
        if ($user = WebAuth::user()) {
            return redirect(self::homeFor($user));
        }

        return view('pages.register');
    }

    public function register(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'max:72'],
            'firstName' => ['required', 'string', 'min:1', 'max:80'],
            'lastName' => ['required', 'string', 'min:1', 'max:80'],
            'role' => [Rule::in(['CUSTOMER', 'BUSINESS_OWNER'])],
        ]);

        if (User::where('email', $data['email'])->exists()) {
            throw ValidationException::withMessages(['email' => 'An account with this email already exists']);
        }

        $user = User::create([
            'email' => $data['email'],
            'passwordHash' => Hash::make($data['password']),
            'firstName' => $data['firstName'],
            'lastName' => $data['lastName'],
            'role' => $data['role'] ?? 'CUSTOMER',
            'status' => 'ACTIVE',
        ]);

        WebAuth::login($user);

        return redirect(self::homeFor($user));
    }

    public function logout()
    {
        WebAuth::logout();

        return redirect('/');
    }

    // A short-lived API access token for the session user, so page scripts
    // can call the bearer-authenticated /api/v1 endpoints.
    public function token()
    {
        $user = WebAuth::user();
        if (! $user) {
            return response()->json(['accessToken' => null], 401);
        }

        return response()->json(['accessToken' => Jwt::signAccessToken($user->id, $user->role)]);
    }
}
