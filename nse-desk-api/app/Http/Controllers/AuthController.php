<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
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

    /** Change name and email. */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')->ignore($user->id)],
        ]);
        $user->update(['name' => trim($data['name']), 'email' => strtolower($data['email'])]);

        return response()->json(['user' => $this->public($user->fresh())]);
    }

    /** Change the password; other devices are logged out, this one stays in. */
    public function updatePassword(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::min(8), 'different:current_password'],
        ]);
        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'Your current password is wrong.']);
        }
        $user->update(['password' => $data['password']]);
        $others = $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();

        return response()->json(['ok' => true, 'loggedOutDevices' => $others]);
    }

    /** How many devices are logged in. */
    public function devices(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json(['devices' => $user->tokens()->count(), 'thisDevice' => $user->currentAccessToken()->name]);
    }

    /** Log out every other device. */
    public function logoutOthers(Request $request): JsonResponse
    {
        $user = $request->user();
        $n = $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();

        return response()->json(['ok' => true, 'loggedOutDevices' => $n]);
    }

    /** Delete the account, its logins and its connected broker accounts. */
    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate(['password' => ['required', 'string']]);
        if (! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => 'Your password is wrong.']);
        }
        $user->tokens()->delete();
        $user->delete(); // broker accounts are removed with it (cascade)

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
