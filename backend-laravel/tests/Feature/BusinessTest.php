<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BusinessTest extends TestCase
{
    use RefreshDatabase;

    private function actingToken(array $overrides = []): array
    {
        $user = User::create([
            'email' => $overrides['email'] ?? 'user'.uniqid().'@example.com',
            'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'Test', 'lastName' => 'User',
            'role' => $overrides['role'] ?? 'BUSINESS_OWNER',
            'status' => 'ACTIVE',
            ...$overrides,
        ]);

        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!'])
            ->json('data.accessToken');

        return [$user, $token];
    }

    private function category(): Category
    {
        return Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);
    }

    public function test_business_owner_creates_a_business_pending_approval(): void
    {
        [$owner, $token] = $this->actingToken(['role' => 'BUSINESS_OWNER']);
        $category = $this->category();

        $response = $this->postJson('/api/v1/businesses', [
            'name' => 'Test Shop', 'slug' => 'test-shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ], ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'PENDING_APPROVAL')
            ->assertJsonPath('data.ownerId', $owner->id);
    }

    public function test_dealer_created_business_is_published_immediately_and_spends_a_point(): void
    {
        [$dealer, $token] = $this->actingToken([
            'role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5,
        ]);
        $category = $this->category();

        $response = $this->postJson('/api/v1/businesses', [
            'name' => 'Dealer Shop', 'slug' => 'dealer-shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ], ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(201)->assertJsonPath('data.status', 'PUBLISHED');
        $this->assertSame(4, $dealer->fresh()->points);
    }

    public function test_dealer_without_points_is_rejected(): void
    {
        [, $token] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 0]);
        $category = $this->category();

        $response = $this->postJson('/api/v1/businesses', [
            'name' => 'No Points Shop', 'slug' => 'no-points-shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ], ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(403)->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_a_customer_cannot_create_a_business(): void
    {
        [, $token] = $this->actingToken(['role' => 'CUSTOMER']);

        $this->postJson('/api/v1/businesses', ['name' => 'x'], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(403);
    }

    public function test_only_the_owner_or_admin_can_update_a_business(): void
    {
        [$owner, $ownerToken] = $this->actingToken(['role' => 'BUSINESS_OWNER']);
        [, $otherToken] = $this->actingToken(['role' => 'BUSINESS_OWNER']);
        $category = $this->category();

        $created = $this->postJson('/api/v1/businesses', [
            'name' => 'Owned Shop', 'slug' => 'owned-shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ], ['Authorization' => "Bearer {$ownerToken}"]);
        $id = $created->json('data.id');

        $this->patchJson("/api/v1/businesses/{$id}", ['name' => 'Hacked'], ['Authorization' => "Bearer {$otherToken}"])
            ->assertStatus(403);

        $this->patchJson("/api/v1/businesses/{$id}", ['name' => 'Renamed'], ['Authorization' => "Bearer {$ownerToken}"])
            ->assertStatus(200)->assertJsonPath('data.name', 'Renamed');
    }

    public function test_published_business_is_visible_in_the_public_list_and_search(): void
    {
        [, $token] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5]);
        $category = $this->category();

        $this->postJson('/api/v1/businesses', [
            'name' => 'Visible Shop', 'slug' => 'visible-shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ], ['Authorization' => "Bearer {$token}"])->assertStatus(201);

        $this->getJson('/api/v1/businesses')->assertStatus(200)->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/search?q=Visible')->assertStatus(200)->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/businesses/visible-shop')->assertStatus(200)->assertJsonPath('data.name', 'Visible Shop');
    }
}
