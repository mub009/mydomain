<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_login_me_logout(): void
    {
        $r = $this->postJson('/api/auth/register', ['name' => 'Asha', 'email' => 'Asha@Example.com', 'password' => 'long-password', 'password_confirmation' => 'long-password'])
            ->assertCreated()->assertJsonPath('user.email', 'asha@example.com');
        $this->assertNotEmpty($r->json('token'));

        $token = $this->postJson('/api/auth/login', ['email' => 'asha@example.com', 'password' => 'long-password'])->assertOk()->json('token');
        $this->withToken($token)->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.name', 'Asha');
        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_wrong_password_and_duplicate_email(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'A', 'email' => 'a@b.co', 'password' => 'long-password', 'password_confirmation' => 'long-password'])->assertCreated();
        $this->postJson('/api/auth/login', ['email' => 'a@b.co', 'password' => 'nope-nope'])->assertStatus(422)->assertJsonValidationErrors('email');
        $this->postJson('/api/auth/register', ['name' => 'A', 'email' => 'a@b.co', 'password' => 'long-password', 'password_confirmation' => 'long-password'])->assertStatus(422);
        $this->postJson('/api/auth/register', ['name' => 'A', 'email' => 'c@b.co', 'password' => 'short', 'password_confirmation' => 'short'])->assertStatus(422);
    }

    public function test_protected_routes_need_a_token(): void
    {
        $this->getJson('/api/zerodha')->assertUnauthorized();
        $this->postJson('/api/zerodha/connect')->assertUnauthorized();
    }
}
