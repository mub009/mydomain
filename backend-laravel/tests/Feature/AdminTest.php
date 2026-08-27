<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $overrides = []): User
    {
        return User::create([
            'email' => $overrides['email'] ?? 'user'.uniqid().'@example.com',
            'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'Test', 'lastName' => 'User', 'status' => 'ACTIVE', 'points' => 0,
            ...$overrides,
        ]);
    }

    private function token(User $user): string
    {
        return $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!'])
            ->json('data.accessToken');
    }

    public function test_non_admins_are_blocked_from_every_admin_route(): void
    {
        $token = $this->token($this->user(['role' => 'CUSTOMER']));

        $this->getJson('/api/v1/admin/stats', ['Authorization' => "Bearer {$token}"])->assertStatus(403);
        $this->getJson('/api/v1/admin/users', ['Authorization' => "Bearer {$token}"])->assertStatus(403);
        $this->getJson('/api/v1/admin/businesses', ['Authorization' => "Bearer {$token}"])->assertStatus(403);
    }

    public function test_stats_reflects_current_counts(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);
        Business::create([
            'ownerId' => $owner->id, 'name' => 'Shop', 'slug' => 'shop', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '9998887777', 'addressLine1' => '1 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ]);

        $token = $this->token($admin);
        $this->getJson('/api/v1/admin/stats', ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)
            ->assertJsonPath('data.businessCount', 1)
            ->assertJsonPath('data.publishedBusinessCount', 1)
            ->assertJsonPath('data.userCount', 2);
    }

    public function test_admin_creates_a_dealer_with_default_privileges_and_zero_points(): void
    {
        $token = $this->token($this->user(['role' => 'ADMIN']));

        $response = $this->postJson('/api/v1/admin/users', [
            'email' => 'dealer@example.com', 'password' => 'Password123!',
            'firstName' => 'D', 'lastName' => 'D', 'role' => 'DEALER',
        ], ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(201)
            ->assertJsonPath('data.privileges', ['MANAGE_LISTINGS'])
            ->assertJsonPath('data.points', 0);
    }

    public function test_admin_grants_points_and_they_show_in_the_transaction_log(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $dealer = $this->user(['role' => 'DEALER', 'points' => 0]);
        $token = $this->token($admin);

        $this->patchJson("/api/v1/admin/users/{$dealer->id}/points", ['amount' => 5, 'note' => 'Welcome bonus'], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)->assertJsonPath('data.points', 5);

        $this->getJson("/api/v1/admin/users/{$dealer->id}/points/transactions", ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)
            ->assertJsonPath('data.0.amount', 5)
            ->assertJsonPath('data.0.balanceAfter', 5);
    }

    public function test_cannot_deduct_more_points_than_a_dealer_has(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $dealer = $this->user(['role' => 'DEALER', 'points' => 2]);
        $token = $this->token($admin);

        $this->patchJson("/api/v1/admin/users/{$dealer->id}/points", ['amount' => -5], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(400);
    }

    public function test_pending_business_can_be_approved(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);
        $business = Business::create([
            'ownerId' => $owner->id, 'name' => 'Shop', 'slug' => 'shop', 'categoryId' => $category->id,
            'status' => 'PENDING_APPROVAL', 'phone' => '9998887777', 'addressLine1' => '1 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ]);
        $token = $this->token($admin);

        $this->getJson('/api/v1/admin/businesses/pending', ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)->assertJsonPath('meta.total', 1);

        $this->postJson("/api/v1/admin/businesses/{$business->id}/approve", [], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'PUBLISHED')
            ->assertJsonPath('data.isVerified', true);
    }

    public function test_business_can_be_reassigned_to_another_eligible_owner(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $newOwner = $this->user(['role' => 'DEALER']);
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);
        $business = Business::create([
            'ownerId' => $owner->id, 'name' => 'Shop', 'slug' => 'shop', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '9998887777', 'addressLine1' => '1 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ]);
        $token = $this->token($admin);

        $this->postJson("/api/v1/admin/businesses/{$business->id}/reassign", ['ownerId' => $newOwner->id], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)->assertJsonPath('data.ownerId', $newOwner->id);
    }

    public function test_the_last_admin_cannot_be_demoted(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $token = $this->token($admin);

        $this->patchJson("/api/v1/admin/users/{$admin->id}", ['role' => 'CUSTOMER'], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(400);
    }
}
