<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PointsTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $overrides = []): User
    {
        return User::create([
            'email' => $overrides['email'] ?? 'user'.uniqid().'@example.com',
            'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'Test', 'lastName' => 'User', 'status' => 'ACTIVE',
            ...$overrides,
        ]);
    }

    private function token(User $user): string
    {
        return $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!'])
            ->json('data.accessToken');
    }

    public function test_a_dealer_sees_their_own_balance(): void
    {
        $dealer = $this->user(['role' => 'DEALER', 'points' => 7]);
        $token = $this->token($dealer);

        $this->getJson('/api/v1/points/mine', ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)
            ->assertJsonPath('data.points', 7)
            ->assertJsonPath('data.businessesRemaining', 7)
            ->assertJsonPath('data.chargeable', true);
    }

    public function test_a_customer_cannot_view_points_endpoints(): void
    {
        $token = $this->token($this->user(['role' => 'CUSTOMER']));

        $this->getJson('/api/v1/points/mine', ['Authorization' => "Bearer {$token}"])->assertStatus(403);
    }
}
