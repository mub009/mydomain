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

    public function test_dealer_created_business_is_published_immediately_and_spends_a_point_per_feature(): void
    {
        [$dealer, $token] = $this->actingToken([
            'role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5,
        ]);
        $category = $this->category();

        $response = $this->postJson('/api/v1/businesses', [
            'name' => 'Dealer Shop', 'slug' => 'dealer-shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
            'features' => ['VISITING_CARD', 'WEBSITE'],
        ], ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(201)->assertJsonPath('data.status', 'PUBLISHED')
            ->assertJsonPath('data.features', ['WEBSITE', 'VISITING_CARD']);
        $this->assertSame(3, $dealer->fresh()->points);
        $this->assertDatabaseHas('point_transactions', ['userId' => $dealer->id, 'type' => 'FEATURE_ADDED', 'feature' => 'WEBSITE', 'amount' => -1]);
    }

    public function test_a_listing_is_free_but_features_need_points(): void
    {
        [$dealer, $token] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 1]);
        $category = $this->category();
        $body = [
            'name' => 'No Points Shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ];
        $auth = ['Authorization' => "Bearer {$token}"];

        // Two features, one point: refused, and nothing is created.
        $this->postJson('/api/v1/businesses', [...$body, 'features' => ['WEBSITE', 'GOLD_RATE']], $auth)
            ->assertStatus(403)->assertJsonPath('error.code', 'FORBIDDEN');
        $this->assertDatabaseCount('businesses', 0);
        // No features: free, and the business gets none.
        $this->postJson('/api/v1/businesses', $body, $auth)->assertStatus(201)->assertJsonPath('data.features', []);
        $this->assertSame(1, $dealer->fresh()->points);
        $this->postJson('/api/v1/businesses', [...$body, 'features' => ['BOGUS']], $auth)->assertStatus(400);
    }

    public function test_owners_and_admins_get_every_feature_for_free(): void
    {
        [, $ownerToken] = $this->actingToken(['role' => 'BUSINESS_OWNER']);
        [$admin, $adminToken] = $this->actingToken(['role' => 'ADMIN', 'points' => 0]);
        $category = $this->category();
        $body = [
            'name' => 'Own Shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'latitude' => 18.5, 'longitude' => 73.8,
        ];

        // An owner can't pick: their listing has everything (null).
        $this->postJson('/api/v1/businesses', [...$body, 'features' => []], ['Authorization' => "Bearer {$ownerToken}"])
            ->assertStatus(201)->assertJsonPath('data.features', null);
        // An admin may pick, free.
        $this->postJson('/api/v1/businesses', [...$body, 'name' => 'Admin Shop', 'features' => ['GOLD_RATE']], ['Authorization' => "Bearer {$adminToken}"])
            ->assertStatus(201)->assertJsonPath('data.features', ['GOLD_RATE']);
        $this->assertSame(0, $admin->fresh()->points);
    }

    public function test_dealer_changes_features_paying_and_getting_points_back(): void
    {
        [$dealer, $token] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 3]);
        [, $otherDealer] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 3]);
        $category = $this->category();
        $auth = ['Authorization' => "Bearer {$token}"];

        $id = $this->postJson('/api/v1/businesses', [
            'name' => 'Feature Shop', 'categoryId' => $category->id,
            'city' => 'Pune', 'state' => 'MH', 'latitude' => 18.5, 'longitude' => 73.8,
            'owner' => ['username' => 'team@feature.test', 'password' => 'Secret123!'],
            'features' => ['WEBSITE'],
        ], $auth)->assertStatus(201)->json('data.id');
        $this->assertSame(2, $dealer->fresh()->points);

        // Swap the website for the card and gold rate: one point back, two spent.
        $this->putJson("/api/v1/businesses/{$id}/features", ['features' => ['VISITING_CARD', 'GOLD_RATE']], $auth)
            ->assertOk()->assertJsonPath('data.spentPoints', 2)->assertJsonPath('data.refundedPoints', 1)
            ->assertJsonPath('data.features', ['VISITING_CARD', 'GOLD_RATE']);
        $this->assertSame(1, $dealer->fresh()->points);
        $this->putJson("/api/v1/businesses/{$id}/features", ['features' => ['WEBSITE', 'VISITING_CARD', 'GOLD_RATE']], $auth)->assertOk();
        $this->assertSame(0, $dealer->fresh()->points);
        // No points left for more: refused (nothing left to add here, so take one off and try two).
        $this->putJson("/api/v1/businesses/{$id}/features", ['features' => []], $auth)->assertOk()->assertJsonPath('data.refundedPoints', 3);
        $this->assertSame(3, $dealer->fresh()->points);
        $this->putJson("/api/v1/businesses/{$id}/features", ['features' => ['WEBSITE', 'VISITING_CARD']], $auth)->assertOk();

        // Not another dealer, and not the business itself.
        $this->putJson("/api/v1/businesses/{$id}/features", ['features' => []], ['Authorization' => "Bearer {$otherDealer}"])->assertStatus(403);
        $ownerToken = $this->postJson('/api/v1/auth/login', ['email' => 'team@feature.test', 'password' => 'Secret123!'])->json('data.accessToken');
        $this->putJson("/api/v1/businesses/{$id}/features", ['features' => ['GOLD_RATE']], ['Authorization' => "Bearer {$ownerToken}"])->assertStatus(403);

        // Deleting gives back everything still paid for.
        $this->deleteJson("/api/v1/businesses/{$id}", [], $auth)->assertOk()->assertJsonPath('data.refundedPoints', 2);
        $this->assertSame(3, $dealer->fresh()->points);
        $this->getJson('/api/v1/points/mine', $auth)->assertJsonPath('data.totalSpent', 0);
    }

    public function test_a_dealer_cannot_add_features_without_points(): void
    {
        [$dealer, $token] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 1]);
        $category = $this->category();
        $auth = ['Authorization' => "Bearer {$token}"];
        $id = $this->postJson('/api/v1/businesses', [
            'name' => 'Short Shop', 'categoryId' => $category->id,
            'city' => 'Pune', 'state' => 'MH', 'latitude' => 18.5, 'longitude' => 73.8,
        ], $auth)->assertStatus(201)->json('data.id');

        $this->putJson("/api/v1/businesses/{$id}/features", ['features' => ['WEBSITE', 'GOLD_RATE']], $auth)->assertStatus(403);
        $this->assertSame(1, $dealer->fresh()->points);
        $this->assertSame([], \App\Models\Business::find($id)->features);
    }

    public function test_a_business_only_reaches_the_features_it_has(): void
    {
        [, $token] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5]);
        $category = $this->category();
        $auth = ['Authorization' => "Bearer {$token}"];
        $id = $this->postJson('/api/v1/businesses', [
            'name' => 'Bare Shop', 'slug' => 'bare-shop', 'categoryId' => $category->id,
            'city' => 'Pune', 'state' => 'MH', 'latitude' => 18.5, 'longitude' => 73.8,
            'features' => ['GOLD_RATE'],
        ], $auth)->assertStatus(201)->json('data.id');

        // No website: not public, and not editable.
        $this->get('/site/bare-shop')->assertNotFound();
        $this->getJson("/api/v1/businesses/{$id}/site", $auth)->assertStatus(403);
        // No visiting card.
        $this->getJson("/api/v1/businesses/{$id}/card", $auth)->assertStatus(403);
        $this->get('/card/bare-shop')->assertNotFound();
        // The listing page itself is always there.
        $this->get('/business/bare-shop')->assertOk();

        $this->putJson("/api/v1/businesses/{$id}/features", ['features' => ['GOLD_RATE', 'WEBSITE', 'VISITING_CARD']], $auth)->assertOk();
        $this->get('/site/bare-shop')->assertOk();
        $this->getJson("/api/v1/businesses/{$id}/card", $auth)->assertOk();
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

    public function test_dealer_adds_a_business_without_phone_or_address(): void
    {
        [, $token] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5]);
        $category = $this->category();

        $id = $this->postJson('/api/v1/businesses', [
            'name' => 'Basics Only', 'categoryId' => $category->id,
            'city' => 'Pune', 'state' => 'Maharashtra', 'latitude' => 18.5, 'longitude' => 73.8,
        ], ['Authorization' => "Bearer {$token}"])->assertStatus(201)->json('data.id');

        $this->assertDatabaseHas('businesses', ['id' => $id, 'phone' => null, 'addressLine1' => null]);
        // The public page and website still render without them.
        $this->get('/business/basics-only')->assertOk();
    }

    public function test_owner_still_needs_phone_and_address_to_add_a_business(): void
    {
        [, $token] = $this->actingToken(['role' => 'BUSINESS_OWNER']);
        $category = $this->category();

        $this->postJson('/api/v1/businesses', [
            'name' => 'Owner Basics', 'categoryId' => $category->id,
            'city' => 'Pune', 'state' => 'Maharashtra', 'latitude' => 18.5, 'longitude' => 73.8,
        ], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(400);
    }

    public function test_business_login_without_contact_names_is_named_after_the_business(): void
    {
        [, $token] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5]);
        $category = $this->category();

        $this->postJson('/api/v1/businesses', [
            'name' => 'Nameless Login Shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'latitude' => 18.5, 'longitude' => 73.8,
            'owner' => ['username' => 'team@nameless.test', 'password' => 'Secret123!'],
        ], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(201)
            ->assertJsonPath('data.ownerAccount.username', 'team@nameless.test');

        $this->assertDatabaseHas('users', ['email' => 'team@nameless.test', 'firstName' => 'Nameless Login Shop', 'lastName' => '', 'role' => 'BUSINESS_OWNER']);
        $this->postJson('/api/v1/auth/login', ['email' => 'team@nameless.test', 'password' => 'Secret123!'])
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
        $this->deleteJson("/api/v1/businesses/{$id}", [], ['Authorization' => "Bearer {$otherDealer}"])->assertStatus(403);
    }

    public function test_dealer_deletes_a_listing_made_by_mistake_and_gets_the_point_back(): void
    {
        [$dealer, $token] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5]);
        $category = $this->category();
        $auth = ['Authorization' => "Bearer {$token}"];

        $id = $this->postJson('/api/v1/businesses', [
            'name' => 'Wrong Shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
            'owner' => ['firstName' => 'Ravi', 'lastName' => 'K', 'username' => '9876543210', 'password' => 'Secret123!'],
            'features' => ['WEBSITE', 'VISITING_CARD', 'GOLD_RATE'],
        ], $auth)->assertStatus(201)->json('data.id');
        $this->assertSame(2, $dealer->fresh()->points);

        $this->deleteJson("/api/v1/businesses/{$id}", [], $auth)
            ->assertStatus(200)->assertJsonPath('data.refundedPoints', 3);

        $this->assertDatabaseMissing('businesses', ['id' => $id]);
        $this->assertSame(5, $dealer->fresh()->points);
        $this->assertDatabaseHas('point_transactions', ['userId' => $dealer->id, 'type' => 'BUSINESS_DELETED', 'amount' => 3, 'balanceAfter' => 5]);
        $this->getJson('/api/v1/points/mine', $auth)->assertJsonPath('data.totalSpent', 0);
    }

    public function test_owner_deleting_a_dealer_made_listing_does_not_refund_the_dealer(): void
    {
        [$dealer, $token] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5]);
        $category = $this->category();

        $id = $this->postJson('/api/v1/businesses', [
            'name' => 'Handed Over', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
            'owner' => ['firstName' => 'Ravi', 'lastName' => 'K', 'username' => 'ravi@example.com', 'password' => 'Secret123!'],
            'features' => ['WEBSITE'],
        ], ['Authorization' => "Bearer {$token}"])->assertStatus(201)->json('data.id');

        $ownerToken = $this->postJson('/api/v1/auth/login', ['email' => 'ravi@example.com', 'password' => 'Secret123!'])->json('data.accessToken');
        $this->deleteJson("/api/v1/businesses/{$id}", [], ['Authorization' => "Bearer {$ownerToken}"])
            ->assertStatus(200)->assertJsonPath('data.refundedPoints', 0);

        $this->assertDatabaseMissing('businesses', ['id' => $id]);
        $this->assertSame(4, $dealer->fresh()->points);
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

    public function test_dealer_can_manage_a_business_created_for_a_client_login(): void
    {
        [$dealer, $dealerToken] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5]);
        [, $otherDealerToken] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5]);
        $category = $this->category();

        $created = $this->postJson('/api/v1/businesses', [
            'name' => 'Client Shop', 'slug' => 'client-shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
            'owner' => [
                'username' => 'client@example.com', 'password' => 'ClientPass123!',
                'firstName' => 'Client', 'lastName' => 'Owner',
            ],
        ], ['Authorization' => "Bearer {$dealerToken}"]);
        $created->assertStatus(201);
        $id = $created->json('data.id');

        // The business is assigned to the fresh client login, not the dealer.
        $client = User::where('email', 'client@example.com')->first();
        $this->assertSame($client->id, $created->json('data.ownerId'));
        $this->assertNotSame($dealer->id, $created->json('data.ownerId'));

        // The dealer who created it (via createdById, not ownerId) can still manage it.
        $this->getJson("/api/v1/businesses/{$id}/manage", ['Authorization' => "Bearer {$dealerToken}"])
            ->assertStatus(200)->assertJsonPath('data.id', $id);
        $this->patchJson("/api/v1/businesses/{$id}", ['name' => 'Client Shop Renamed'], ['Authorization' => "Bearer {$dealerToken}"])
            ->assertStatus(200)->assertJsonPath('data.name', 'Client Shop Renamed');

        // A dealer who did not create it still cannot.
        $this->getJson("/api/v1/businesses/{$id}/manage", ['Authorization' => "Bearer {$otherDealerToken}"])
            ->assertStatus(403);
    }

    public function test_a_client_login_can_be_a_phone_number_with_no_email(): void
    {
        [, $dealerToken] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5]);
        $category = $this->category();

        $created = $this->postJson('/api/v1/businesses', [
            'name' => 'Phone Login Shop', 'slug' => 'phone-login-shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
            'owner' => [
                'username' => '9123456780', 'password' => 'ClientPass123!',
                'firstName' => 'Client', 'lastName' => 'Owner',
            ],
        ], ['Authorization' => "Bearer {$dealerToken}"]);

        $created->assertStatus(201);
        $this->assertSame('9123456780', $created->json('data.ownerAccount.username'));
        $client = User::where('phone', '9123456780')->first();
        $this->assertNull($client->email);
        $this->assertSame($client->id, $created->json('data.ownerId'));

        // The phone-only account can sign in using its phone as the username.
        $this->postJson('/api/v1/auth/login', ['email' => '9123456780', 'password' => 'ClientPass123!'])
            ->assertStatus(200)->assertJsonPath('data.user.id', $client->id);
    }

    public function test_creating_a_client_login_requires_an_email_or_a_phone(): void
    {
        [, $dealerToken] = $this->actingToken(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => 5]);
        $category = $this->category();

        $this->postJson('/api/v1/businesses', [
            'name' => 'No Login Shop', 'slug' => 'no-login-shop', 'categoryId' => $category->id,
            'phone' => '9998887777', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
            'owner' => [
                'password' => 'ClientPass123!', 'firstName' => 'Client', 'lastName' => 'Owner',
            ],
        ], ['Authorization' => "Bearer {$dealerToken}"])->assertStatus(400);
    }
}
