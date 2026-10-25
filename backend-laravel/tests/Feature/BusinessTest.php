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

    public function test_business_type_defaults_to_b2c_and_can_be_set_to_b2b(): void
    {
        [, $token] = $this->actingToken(['role' => 'BUSINESS_OWNER']);
        $category = $this->category();

        $default = $this->postJson('/api/v1/businesses', [
            'name' => 'Consumer Shop', 'slug' => 'consumer-shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ], ['Authorization' => "Bearer {$token}"]);
        $default->assertStatus(201)->assertJsonPath('data.businessType', 'B2C');

        $b2b = $this->postJson('/api/v1/businesses', [
            'name' => 'Bulk Supplier', 'slug' => 'bulk-supplier', 'categoryId' => $category->id,
            'businessType' => 'B2B',
            'phone' => '9998887778', 'addressLine1' => '2 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ], ['Authorization' => "Bearer {$token}"]);
        $b2b->assertStatus(201)->assertJsonPath('data.businessType', 'B2B');

        $this->assertDatabaseHas('businesses', ['slug' => 'consumer-shop', 'businessType' => 'B2C']);
        $this->assertDatabaseHas('businesses', ['slug' => 'bulk-supplier', 'businessType' => 'B2B']);
    }

    public function test_owner_changes_business_type_after_creation(): void
    {
        [, $token] = $this->actingToken(['role' => 'BUSINESS_OWNER']);
        $category = $this->category();

        $created = $this->postJson('/api/v1/businesses', [
            'name' => 'Shop', 'slug' => 'shop-type-switch', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ], ['Authorization' => "Bearer {$token}"]);
        $id = $created->json('data.id');

        $this->patchJson("/api/v1/businesses/{$id}", ['businessType' => 'B2B'], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)
            ->assertJsonPath('data.businessType', 'B2B');
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

    public function test_slug_is_generated_from_the_name_and_kept_unique(): void
    {
        [, $token] = $this->actingToken(['role' => 'BUSINESS_OWNER']);
        $category = $this->category();
        $body = [
            'name' => "Joe's Plumbing & Co", 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ];

        $this->postJson('/api/v1/businesses', $body, ['Authorization' => "Bearer {$token}"])
            ->assertStatus(201)->assertJsonPath('data.slug', 'joe-s-plumbing-co');
        $this->postJson('/api/v1/businesses', $body, ['Authorization' => "Bearer {$token}"])
            ->assertStatus(201)->assertJsonPath('data.slug', 'joe-s-plumbing-co-2');
    }

    public function test_dealer_creates_a_business_login_with_a_mobile_number_username(): void
    {
        [, $token] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5]);
        $category = $this->category();

        $this->postJson('/api/v1/businesses', [
            'name' => 'Mobile Shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
            'owner' => ['firstName' => 'Ravi', 'lastName' => 'K', 'username' => '+91 98765 43210', 'password' => 'Secret123!'],
        ], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(201)
            ->assertJsonPath('data.ownerAccount.username', '9876543210');

        $this->assertDatabaseHas('users', ['phone' => '9876543210', 'email' => null, 'role' => 'BUSINESS_OWNER']);
        $this->postJson('/api/v1/auth/login', ['email' => '9876543210', 'password' => 'Secret123!'])
            ->assertStatus(200);
    }

    public function test_business_login_username_can_still_be_an_email(): void
    {
        [, $token] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5]);
        $category = $this->category();

        $this->postJson('/api/v1/businesses', [
            'name' => 'Email Shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
            'owner' => ['firstName' => 'Asha', 'lastName' => 'M', 'username' => 'asha@shop.test', 'password' => 'Secret123!'],
        ], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(201)
            ->assertJsonPath('data.ownerAccount.username', 'asha@shop.test');

        $this->postJson('/api/v1/auth/login', ['email' => 'asha@shop.test', 'password' => 'Secret123!'])
            ->assertStatus(200);
    }

    public function test_dealer_keeps_managing_a_business_handed_to_its_own_login(): void
    {
        [, $token] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5]);
        [, $otherDealer] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5]);
        $category = $this->category();
        $auth = ['Authorization' => "Bearer {$token}"];

        $id = $this->postJson('/api/v1/businesses', [
            'name' => 'Handed Over', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
            'owner' => ['firstName' => 'Ravi', 'lastName' => 'K', 'username' => '9876543210', 'password' => 'Secret123!'],
        ], $auth)->assertStatus(201)->json('data.id');

        $this->getJson('/api/v1/businesses/mine', $auth)->assertStatus(200)->assertJsonPath('data.0.id', $id);
        $this->getJson("/api/v1/businesses/{$id}/manage", $auth)->assertStatus(200);
        $this->patchJson("/api/v1/businesses/{$id}", ['name' => 'Renamed by dealer', 'city' => 'Mumbai'], $auth)
            ->assertStatus(200)->assertJsonPath('data.name', 'Renamed by dealer');
        $this->postJson("/api/v1/businesses/{$id}/services", ['name' => 'Repair', 'priceCents' => 50000], $auth)->assertStatus(201);

        $this->patchJson("/api/v1/businesses/{$id}", ['name' => 'Not mine'], ['Authorization' => "Bearer {$otherDealer}"])
            ->assertStatus(403);
        $this->deleteJson("/api/v1/businesses/{$id}", [], $auth)->assertStatus(403);
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
