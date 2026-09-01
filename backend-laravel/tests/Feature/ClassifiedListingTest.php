<?php

namespace Tests\Feature;

use App\Models\ClassifiedCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ClassifiedListingTest extends TestCase
{
    use RefreshDatabase;

    private function actingToken(array $overrides = []): array
    {
        $user = User::create([
            'email' => $overrides['email'] ?? 'user'.uniqid().'@example.com',
            'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'Test', 'lastName' => 'User',
            'role' => $overrides['role'] ?? 'CUSTOMER',
            'status' => 'ACTIVE',
            ...$overrides,
        ]);

        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!'])
            ->json('data.accessToken');

        return [$user, $token];
    }

    private function category(): ClassifiedCategory
    {
        return ClassifiedCategory::firstOrCreate(['slug' => 'mobiles'], ['name' => 'Mobiles']);
    }

    private function listingPayload(array $overrides = []): array
    {
        return [
            'title' => 'iPhone 15 Pro 256GB',
            'description' => 'Used iPhone in excellent condition.',
            'categoryId' => $this->category()->id,
            'condition' => 'USED',
            'priceCents' => 6500000,
            'city' => 'Malappuram',
            'state' => 'Kerala',
            'contactPhone' => '9998887777',
            'photos' => ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
            ...$overrides,
        ];
    }

    // Puts a real object on the fake "spaces" disk and points the configured
    // CDN base at a URL that actually matches it, so ClassifiedPhotoCleaner
    // has something real to find and delete instead of skipping every photo
    // as "not ours" (as it would with the plain https://cdn.example.com
    // fixtures the other tests in this file use).
    private function fakeStoredPhoto(string $key = 'classifieds/photo.webp'): string
    {
        config(['filesystems.disks.spaces.url' => 'https://cdn.test']);
        Storage::fake('spaces');
        Storage::disk('spaces')->put($key, 'fake-image-bytes');

        return 'https://cdn.test/'.$key;
    }

    public function test_any_signed_in_user_can_post_a_listing_and_it_is_instantly_active(): void
    {
        [$seller, $token] = $this->actingToken(['role' => 'CUSTOMER']);

        $response = $this->postJson('/api/v1/classifieds', $this->listingPayload(), ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'ACTIVE')
            ->assertJsonPath('data.sellerId', $seller->id)
            ->assertJsonCount(2, 'data.photos');
    }

    public function test_a_customer_without_login_cannot_post_a_listing(): void
    {
        $this->postJson('/api/v1/classifieds', $this->listingPayload())->assertStatus(401);
    }

    public function test_posting_requires_at_least_one_photo(): void
    {
        [, $token] = $this->actingToken();

        $this->postJson('/api/v1/classifieds', $this->listingPayload(['photos' => []]), ['Authorization' => "Bearer {$token}"])
            ->assertStatus(400);
    }

    public function test_only_active_listings_show_up_in_public_browse(): void
    {
        [, $token] = $this->actingToken();

        $created = $this->postJson('/api/v1/classifieds', $this->listingPayload(['title' => 'Visible Item']), ['Authorization' => "Bearer {$token}"]);
        $id = $created->json('data.id');

        $this->getJson('/api/v1/classifieds')->assertStatus(200)->assertJsonPath('meta.total', 1);

        $this->postJson("/api/v1/classifieds/{$id}/pause", [], ['Authorization' => "Bearer {$token}"])->assertStatus(200);
        $this->getJson('/api/v1/classifieds')->assertStatus(200)->assertJsonPath('meta.total', 0);
    }

    public function test_browse_filters_by_keyword_condition_and_price_range(): void
    {
        [, $token] = $this->actingToken();

        $this->postJson('/api/v1/classifieds', $this->listingPayload(['title' => 'iPhone 15 Pro', 'description' => 'Great phone.', 'priceCents' => 6500000, 'condition' => 'USED']), ['Authorization' => "Bearer {$token}"]);
        $this->postJson('/api/v1/classifieds', $this->listingPayload(['title' => 'Wooden Chair', 'description' => 'Solid oak.', 'priceCents' => 150000, 'condition' => 'NEW']), ['Authorization' => "Bearer {$token}"]);

        $this->getJson('/api/v1/classifieds?q=iPhone')->assertStatus(200)->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/classifieds?condition=NEW')->assertStatus(200)->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/classifieds?minPriceCents=1000000')->assertStatus(200)->assertJsonPath('meta.total', 1);
    }

    public function test_only_the_seller_or_admin_can_edit_or_delete_a_listing(): void
    {
        [, $sellerToken] = $this->actingToken();
        [, $otherToken] = $this->actingToken();
        [, $adminToken] = $this->actingToken(['role' => 'ADMIN']);

        $created = $this->postJson('/api/v1/classifieds', $this->listingPayload(), ['Authorization' => "Bearer {$sellerToken}"]);
        $id = $created->json('data.id');

        $this->patchJson("/api/v1/classifieds/{$id}", ['title' => 'Hacked'], ['Authorization' => "Bearer {$otherToken}"])->assertStatus(403);
        $this->patchJson("/api/v1/classifieds/{$id}", ['title' => 'iPhone 15 Pro Max'], ['Authorization' => "Bearer {$sellerToken}"])
            ->assertStatus(200)->assertJsonPath('data.title', 'iPhone 15 Pro Max');
        $this->patchJson("/api/v1/classifieds/{$id}", ['title' => 'Admin Edit'], ['Authorization' => "Bearer {$adminToken}"])
            ->assertStatus(200)->assertJsonPath('data.title', 'Admin Edit');

        $this->deleteJson("/api/v1/classifieds/{$id}", [], ['Authorization' => "Bearer {$otherToken}"])->assertStatus(403);
        $this->deleteJson("/api/v1/classifieds/{$id}", [], ['Authorization' => "Bearer {$sellerToken}"])->assertStatus(204);
    }

    public function test_seller_can_mark_sold_pause_and_renew_a_listing(): void
    {
        [, $token] = $this->actingToken();
        $created = $this->postJson('/api/v1/classifieds', $this->listingPayload(), ['Authorization' => "Bearer {$token}"]);
        $id = $created->json('data.id');
        $this->assertNotNull($created->json('data.expiresAt'));

        $this->postJson("/api/v1/classifieds/{$id}/sold", [], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)->assertJsonPath('data.status', 'SOLD');

        $this->postJson("/api/v1/classifieds/{$id}/pause", [], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)->assertJsonPath('data.status', 'PAUSED');

        $renewed = $this->postJson("/api/v1/classifieds/{$id}/renew", [], ['Authorization' => "Bearer {$token}"]);
        $renewed->assertStatus(200)->assertJsonPath('data.status', 'ACTIVE');
        $this->assertNotNull($renewed->json('data.expiresAt'));
    }

    public function test_viewing_a_listing_increments_its_view_count(): void
    {
        [, $token] = $this->actingToken();
        $id = $this->postJson('/api/v1/classifieds', $this->listingPayload(), ['Authorization' => "Bearer {$token}"])->json('data.id');

        $this->getJson("/api/v1/classifieds/{$id}")->assertStatus(200)->assertJsonPath('data.viewCount', 1);
        $this->getJson("/api/v1/classifieds/{$id}")->assertStatus(200)->assertJsonPath('data.viewCount', 2);
    }

    public function test_favoriting_a_listing_is_idempotent_and_bumps_favorite_count(): void
    {
        [, $sellerToken] = $this->actingToken();
        [$buyer, $buyerToken] = $this->actingToken();
        $id = $this->postJson('/api/v1/classifieds', $this->listingPayload(), ['Authorization' => "Bearer {$sellerToken}"])->json('data.id');

        $this->postJson("/api/v1/classifieds/{$id}/favorite", [], ['Authorization' => "Bearer {$buyerToken}"])->assertStatus(201);
        // Favoriting twice does not double-count.
        $this->postJson("/api/v1/classifieds/{$id}/favorite", [], ['Authorization' => "Bearer {$buyerToken}"])->assertStatus(201);

        $this->getJson("/api/v1/classifieds/{$id}")->assertStatus(200)->assertJsonPath('data.favoriteCount', 1);

        $favorites = $this->getJson('/api/v1/classifieds/favorites', ['Authorization' => "Bearer {$buyerToken}"]);
        $favorites->assertStatus(200)->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $id);

        $this->deleteJson("/api/v1/classifieds/{$id}/favorite", [], ['Authorization' => "Bearer {$buyerToken}"])->assertStatus(204);
        $this->getJson("/api/v1/classifieds/{$id}")->assertStatus(200)->assertJsonPath('data.favoriteCount', 0);
    }

    public function test_admin_can_remove_or_delete_any_listing(): void
    {
        [, $sellerToken] = $this->actingToken();
        [, $adminToken] = $this->actingToken(['role' => 'ADMIN']);
        $id = $this->postJson('/api/v1/classifieds', $this->listingPayload(), ['Authorization' => "Bearer {$sellerToken}"])->json('data.id');

        $this->postJson("/api/v1/admin/classifieds/{$id}/remove", [], ['Authorization' => "Bearer {$adminToken}"])
            ->assertStatus(200)->assertJsonPath('data.status', 'REMOVED');
        $this->getJson('/api/v1/classifieds')->assertStatus(200)->assertJsonPath('meta.total', 0);

        $this->deleteJson("/api/v1/admin/classifieds/{$id}", [], ['Authorization' => "Bearer {$adminToken}"])->assertStatus(204);
    }

    public function test_non_admin_cannot_reach_classifieds_admin_endpoints(): void
    {
        [, $token] = $this->actingToken();
        $this->getJson('/api/v1/admin/classifieds', ['Authorization' => "Bearer {$token}"])->assertStatus(403);
    }

    public function test_marking_a_listing_sold_deletes_its_photo_file_from_storage(): void
    {
        $photoUrl = $this->fakeStoredPhoto();
        [, $token] = $this->actingToken();
        $id = $this->postJson('/api/v1/classifieds', $this->listingPayload(['photos' => [$photoUrl]]), ['Authorization' => "Bearer {$token}"])->json('data.id');
        Storage::disk('spaces')->assertExists('classifieds/photo.webp');

        $sold = $this->postJson("/api/v1/classifieds/{$id}/sold", [], ['Authorization' => "Bearer {$token}"]);
        $sold->assertStatus(200)->assertJsonPath('data.status', 'SOLD')->assertJsonCount(0, 'data.photos');

        Storage::disk('spaces')->assertMissing('classifieds/photo.webp');
        $this->assertDatabaseCount('classified_listing_photos', 0);
    }

    public function test_deleting_a_listing_deletes_its_photo_file_from_storage(): void
    {
        $photoUrl = $this->fakeStoredPhoto();
        [, $token] = $this->actingToken();
        $id = $this->postJson('/api/v1/classifieds', $this->listingPayload(['photos' => [$photoUrl]]), ['Authorization' => "Bearer {$token}"])->json('data.id');

        $this->deleteJson("/api/v1/classifieds/{$id}", [], ['Authorization' => "Bearer {$token}"])->assertStatus(204);

        Storage::disk('spaces')->assertMissing('classifieds/photo.webp');
    }

    public function test_pausing_or_renewing_a_listing_does_not_touch_its_photo_files(): void
    {
        $photoUrl = $this->fakeStoredPhoto();
        [, $token] = $this->actingToken();
        $id = $this->postJson('/api/v1/classifieds', $this->listingPayload(['photos' => [$photoUrl]]), ['Authorization' => "Bearer {$token}"])->json('data.id');

        $this->postJson("/api/v1/classifieds/{$id}/pause", [], ['Authorization' => "Bearer {$token}"])->assertStatus(200);
        $this->postJson("/api/v1/classifieds/{$id}/renew", [], ['Authorization' => "Bearer {$token}"])->assertStatus(200);

        Storage::disk('spaces')->assertExists('classifieds/photo.webp');
        $this->assertDatabaseCount('classified_listing_photos', 1);
    }

    public function test_admin_removing_or_deleting_a_listing_deletes_its_photo_file_from_storage(): void
    {
        $photoUrl = $this->fakeStoredPhoto();
        [, $sellerToken] = $this->actingToken();
        [, $adminToken] = $this->actingToken(['role' => 'ADMIN']);
        $id = $this->postJson('/api/v1/classifieds', $this->listingPayload(['photos' => [$photoUrl]]), ['Authorization' => "Bearer {$sellerToken}"])->json('data.id');

        $this->postJson("/api/v1/admin/classifieds/{$id}/remove", [], ['Authorization' => "Bearer {$adminToken}"])
            ->assertStatus(200)->assertJsonPath('data.status', 'REMOVED');
        Storage::disk('spaces')->assertMissing('classifieds/photo.webp');

        // A second photo, so deleteClassified has something of its own to clean up.
        $secondUrl = $this->fakeStoredPhoto('classifieds/second.webp');
        $id2 = $this->postJson('/api/v1/classifieds', $this->listingPayload(['photos' => [$secondUrl]]), ['Authorization' => "Bearer {$sellerToken}"])->json('data.id');

        $this->deleteJson("/api/v1/admin/classifieds/{$id2}", [], ['Authorization' => "Bearer {$adminToken}"])->assertStatus(204);
        Storage::disk('spaces')->assertMissing('classifieds/second.webp');
    }

    public function test_batch_lookup_does_not_bump_view_count(): void
    {
        [, $token] = $this->actingToken();
        $id = $this->postJson('/api/v1/classifieds', $this->listingPayload(), ['Authorization' => "Bearer {$token}"])->json('data.id');

        $batch = $this->getJson("/api/v1/classifieds/batch?ids={$id}");
        $batch->assertStatus(200)->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $id);

        // Unlike show(), a batch (recently-viewed) lookup must not inflate stats.
        $this->getJson("/api/v1/classifieds/{$id}")->assertStatus(200)->assertJsonPath('data.viewCount', 1);
    }
}
