<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\RefreshToken;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\Jwt;
use App\Support\Privileges;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    private function issueTokens(string $userId, string $role): array
    {
        $accessToken = Jwt::signAccessToken($userId, $role);
        $refreshToken = Str::uuid()->toString().Str::uuid()->toString();

        RefreshToken::create([
            'token' => $refreshToken,
            'userId' => $userId,
            'expiresAt' => now()->addSeconds(Jwt::ttlToSeconds(config('jwt.refresh_ttl'))),
        ]);

        return ['accessToken' => $accessToken, 'refreshToken' => $refreshToken];
    }

    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'email' => $user->email,
            'firstName' => $user->firstName,
            'lastName' => $user->lastName,
            'role' => $user->role,
            'status' => $user->status,
            'privileges' => Privileges::normalize($user->privileges),
        ];
    }

    public function register(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'phone' => ['nullable', 'string', 'min:7', 'max:20'],
            'password' => ['required', 'string', 'min:8', 'max:72'],
            'firstName' => ['required', 'string', 'min:1', 'max:80'],
            'lastName' => ['required', 'string', 'min:1', 'max:80'],
            'role' => [Rule::in(['CUSTOMER', 'BUSINESS_OWNER'])],
        ]);

        if (User::where('email', $data['email'])->exists()) {
            throw ApiException::conflict('An account with this email already exists');
        }

        $user = User::create([
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'passwordHash' => Hash::make($data['password']),
            'firstName' => $data['firstName'],
            'lastName' => $data['lastName'],
            'role' => $data['role'] ?? 'CUSTOMER',
            'status' => 'ACTIVE',
        ]);

        $tokens = $this->issueTokens($user->id, $user->role);

        return ApiResponse::created(['user' => $this->present($user), ...$tokens]);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            // A business login handed out by a dealer may only have a phone
            // number, so the "email" field here doubles as a username — it's
            // matched against either column rather than validated as email.
            'email' => ['required', 'string', 'max:190'],
            'password' => ['required', 'string', 'min:1'],
        ]);

        $user = User::where('email', $data['email'])->orWhere('phone', $data['email'])->first();
        if (! $user || ! Hash::check($data['password'], $user->passwordHash)) {
            throw ApiException::unauthorized('Invalid email or password');
        }

        if ($user->status === 'SUSPENDED') {
            throw ApiException::forbidden('Account suspended');
        }

        $tokens = $this->issueTokens($user->id, $user->role);

        return ApiResponse::ok(['user' => $this->present($user), ...$tokens]);
    }

    public function refresh(Request $request)
    {
        $data = $request->validate(['refreshToken' => ['required', 'string', 'min:10']]);

        $stored = RefreshToken::with('user')->where('token', $data['refreshToken'])->first();
        if (! $stored || $stored->revokedAt !== null || $stored->expiresAt->isPast()) {
            throw ApiException::unauthorized('Invalid refresh token');
        }

        $stored->update(['revokedAt' => now()]);

        return ApiResponse::ok($this->issueTokens($stored->userId, $stored->user->role));
    }

    public function logout(Request $request)
    {
        $data = $request->validate(['refreshToken' => ['required', 'string', 'min:10']]);

        RefreshToken::where('token', $data['refreshToken'])->whereNull('revokedAt')->update(['revokedAt' => now()]);

        return ApiResponse::ok(['message' => 'Logged out']);
    }

    public function me(Request $request)
    {
        $auth = $request->attributes->get('auth');
        $user = User::find($auth['sub']);
        if (! $user) {
            throw ApiException::notFound('User not found');
        }

        return ApiResponse::ok([
            'id' => $user->id,
            'email' => $user->email,
            'phone' => $user->phone,
            'firstName' => $user->firstName,
            'lastName' => $user->lastName,
            'role' => $user->role,
            'status' => $user->status,
            'privileges' => Privileges::normalize($user->privileges),
            'points' => $user->points,
            'avatarUrl' => $user->avatarUrl,
            'createdAt' => $user->createdAt,
        ]);
    }
}
