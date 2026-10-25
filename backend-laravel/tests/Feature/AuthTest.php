<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_creates_a_user_and_returns_tokens(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'email' => 'new@example.com',
            'password' => 'Password123!',
            'firstName' => 'New',
            'lastName' => 'User',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.email', 'new@example.com')
            ->assertJsonPath('data.user.role', 'CUSTOMER')
            ->assertJsonStructure(['data' => ['accessToken', 'refreshToken']]);

        $this->assertDatabaseHas('users', ['email' => 'new@example.com']);
    }

    public function test_register_rejects_duplicate_email(): void
    {
        User::create([
            'email' => 'dup@example.com', 'passwordHash' => Hash::make('x'),
            'firstName' => 'A', 'lastName' => 'B', 'role' => 'CUSTOMER', 'status' => 'ACTIVE',
        ]);

        $response = $this->postJson('/api/v1/auth/register', [
            'email' => 'dup@example.com', 'password' => 'Password123!', 'firstName' => 'X', 'lastName' => 'Y',
        ]);

        $response->assertStatus(409)->assertJsonPath('error.code', 'CONFLICT');
    }

    public function test_login_rejects_wrong_password(): void
    {
        User::create([
            'email' => 'a@example.com', 'passwordHash' => Hash::make('correct-password'),
            'firstName' => 'A', 'lastName' => 'B', 'role' => 'CUSTOMER', 'status' => 'ACTIVE',
        ]);

        $response = $this->postJson('/api/v1/auth/login', ['email' => 'a@example.com', 'password' => 'wrong']);

        $response->assertStatus(401)->assertJsonPath('error.code', 'UNAUTHORIZED');
    }

    public function test_login_accepts_a_phone_number_as_the_username(): void
    {
        $user = User::create([
            'email' => 'a@example.com', 'phone' => '9998887777', 'passwordHash' => Hash::make('correct-password'),
            'firstName' => 'A', 'lastName' => 'B', 'role' => 'CUSTOMER', 'status' => 'ACTIVE',
        ]);

        $response = $this->postJson('/api/v1/auth/login', ['email' => '9998887777', 'password' => 'correct-password']);

        $response->assertStatus(200)->assertJsonPath('data.user.id', $user->id);
    }

    public function test_login_then_refresh_rotates_the_refresh_token(): void
    {
        User::create([
            'email' => 'a@example.com', 'passwordHash' => Hash::make('correct-password'),
            'firstName' => 'A', 'lastName' => 'B', 'role' => 'CUSTOMER', 'status' => 'ACTIVE',
        ]);

        $login = $this->postJson('/api/v1/auth/login', ['email' => 'a@example.com', 'password' => 'correct-password']);
        $login->assertStatus(200);
        $refreshToken = $login->json('data.refreshToken');

        $refresh = $this->postJson('/api/v1/auth/refresh', ['refreshToken' => $refreshToken]);
        $refresh->assertStatus(200)->assertJsonStructure(['data' => ['accessToken', 'refreshToken']]);
        $this->assertNotSame($refreshToken, $refresh->json('data.refreshToken'));

        // The old refresh token is now revoked and cannot be reused.
        $this->postJson('/api/v1/auth/refresh', ['refreshToken' => $refreshToken])
            ->assertStatus(401)->assertJsonPath('error.code', 'UNAUTHORIZED');
    }

    public function test_me_requires_a_bearer_token(): void
    {
        $this->getJson('/api/v1/auth/me')->assertStatus(401)->assertJsonPath('error.code', 'UNAUTHORIZED');
    }

    public function test_me_returns_the_authenticated_profile(): void
    {
        $user = User::create([
            'email' => 'a@example.com', 'passwordHash' => Hash::make('correct-password'),
            'firstName' => 'A', 'lastName' => 'B', 'role' => 'CUSTOMER', 'status' => 'ACTIVE',
        ]);

        $login = $this->postJson('/api/v1/auth/login', ['email' => 'a@example.com', 'password' => 'correct-password']);
        $token = $login->json('data.accessToken');

        $this->getJson('/api/v1/auth/me', ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)
            ->assertJsonPath('data.id', $user->id);
    }
}
