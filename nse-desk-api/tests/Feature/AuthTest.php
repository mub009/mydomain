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

    private function signup(string $email = 'ravi@example.com'): string
    {
        return $this->postJson('/api/auth/register', ['name' => 'Ravi', 'email' => $email, 'password' => 'long-password', 'password_confirmation' => 'long-password'])->json('token');
    }

    public function test_update_profile(): void
    {
        $this->signup('taken@example.com');
        $this->app['auth']->forgetGuards();
        $t = $this->signup();
        $this->withToken($t)->putJson('/api/auth/profile', ['name' => 'Ravi K', 'email' => 'Ravi.K@Example.com'])
            ->assertOk()->assertJsonPath('user.name', 'Ravi K')->assertJsonPath('user.email', 'ravi.k@example.com');
        $this->withToken($t)->putJson('/api/auth/profile', ['name' => 'Ravi', 'email' => 'taken@example.com'])->assertStatus(422)->assertJsonValidationErrors('email');
        $this->withToken($t)->putJson('/api/auth/profile', ['name' => 'Ravi', 'email' => 'ravi.k@example.com'])->assertOk(); // own email is fine
    }

    public function test_change_password_logs_out_other_devices(): void
    {
        $t1 = $this->signup();
        $t2 = $this->postJson('/api/auth/login', ['email' => 'ravi@example.com', 'password' => 'long-password'])->json('token');
        $this->withToken($t1)->getJson('/api/auth/devices')->assertJsonPath('devices', 2);

        $this->withToken($t1)->putJson('/api/auth/password', ['current_password' => 'wrong', 'password' => 'new-password-1', 'password_confirmation' => 'new-password-1'])
            ->assertStatus(422)->assertJsonValidationErrors('current_password');
        $this->withToken($t1)->putJson('/api/auth/password', ['current_password' => 'long-password', 'password' => 'new-password-1', 'password_confirmation' => 'new-password-1'])
            ->assertOk()->assertJsonPath('loggedOutDevices', 1);

        $this->app['auth']->forgetGuards();
        $this->withToken($t2)->getJson('/api/auth/me')->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->withToken($t1)->getJson('/api/auth/me')->assertOk();
        $this->postJson('/api/auth/login', ['email' => 'ravi@example.com', 'password' => 'new-password-1'])->assertOk();
    }

    public function test_logout_other_devices(): void
    {
        $t1 = $this->signup();
        $t2 = $this->postJson('/api/auth/login', ['email' => 'ravi@example.com', 'password' => 'long-password'])->json('token');
        $this->withToken($t1)->postJson('/api/auth/logout-others')->assertJsonPath('loggedOutDevices', 1);
        $this->app['auth']->forgetGuards();
        $this->withToken($t2)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_delete_account_needs_the_password(): void
    {
        $t = $this->signup();
        $this->withToken($t)->deleteJson('/api/auth/account', ['password' => 'nope'])->assertStatus(422);
        $this->withToken($t)->deleteJson('/api/auth/account', ['password' => 'long-password'])->assertOk();
        $this->assertDatabaseMissing('users', ['email' => 'ravi@example.com']);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
