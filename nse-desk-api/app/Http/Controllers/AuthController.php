<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/** Sign up, log in and out with a bearer token (Laravel Sanctum). */
class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'device' => ['nullable', 'string', 'max:60'],
        ]);
        $user = User::create(['name' => $data['name'], 'email' => strtolower($data['email']), 'password' => $data['password']]);

        return response()->json($this->session($user, $data['device'] ?? null), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device' => ['nullable', 'string', 'max:60'],
        ]);
        $user = User::where('email', strtolower($data['email']))->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'Wrong email or password.']);
        }

        return response()->json($this->session($user, $data['device'] ?? null));
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->public($request->user())]);
    }

    /** Ends this device's login only. */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }

    private function session(User $user, ?string $device): array
    {
        return ['token' => $user->createToken($device ?: 'web')->plainTextToken, 'user' => $this->public($user)];
    }

    private function public(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email];
    }
}
