<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Category;
use App\Models\ReviewQrCode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ReviewQrTest extends TestCase
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

    private function business(User $owner, array $overrides = []): Business
    {
        $category = Category::firstOrCreate(['slug' => 'restaurants'], ['name' => 'Restaurants']);

        return Business::create([
            'ownerId' => $owner->id, 'name' => 'Shop', 'slug' => 'shop-'.uniqid(), 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '9998887777', 'addressLine1' => '1 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
            ...$overrides,
        ]);
    }

    public function test_admin_generates_a_batch_of_unique_codes(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $token = $this->token($admin);

        $response = $this->postJson('/api/v1/admin/qr-codes/batch', ['count' => 5, 'batchLabel' => 'Diwali'], ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(201)->assertJsonPath('data.created', 5)->assertJsonPath('data.batchLabel', 'Diwali');
        $codes = $response->json('data.codes');
        $this->assertCount(5, array_unique($codes));
        foreach ($codes as $code) {
            $this->assertMatchesRegularExpression('/^MK-[A-Z0-9]{6}$/', $code);
        }
    }

    public function test_only_an_admin_can_generate_or_list_codes(): void
    {
        $token = $this->token($this->user(['role' => 'BUSINESS_OWNER']));

        $this->postJson('/api/v1/admin/qr-codes/batch', ['count' => 1], ['Authorization' => "Bearer {$token}"])->assertStatus(403);
        $this->getJson('/api/v1/admin/qr-codes', ['Authorization' => "Bearer {$token}"])->assertStatus(403);
    }

    public function test_owner_looks_up_and_claims_an_unassigned_code(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner, ['googlePlaceId' => 'abc123']);
        ReviewQrCode::create(['code' => 'MK-ABC123', 'status' => 'UNASSIGNED', 'scanCount' => 0]);

        $this->getJson('/api/v1/qr-codes/lookup/mk-abc123')
            ->assertStatus(200)->assertJsonPath('data.status', 'UNASSIGNED');

        $token = $this->token($owner);
        $claim = $this->postJson('/api/v1/qr-codes/claim', ['code' => 'MK-ABC123', 'businessId' => $business->id], ['Authorization' => "Bearer {$token}"]);
        $claim->assertStatus(200)
            ->assertJsonPath('data.status', 'ASSIGNED')
            ->assertJsonPath('data.effectiveChannel', 'GOOGLE');
    }

    public function test_a_disabled_code_cannot_be_claimed(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        ReviewQrCode::create(['code' => 'MK-DEAD01', 'status' => 'DISABLED', 'scanCount' => 0]);

        $token = $this->token($owner);
        $this->postJson('/api/v1/qr-codes/claim', ['code' => 'MK-DEAD01', 'businessId' => $business->id], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(400);
    }

    public function test_claiming_an_already_assigned_code_conflicts(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $other = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $otherBusiness = $this->business($other, ['slug' => 'other-shop']);
        ReviewQrCode::create(['code' => 'MK-TAKEN1', 'status' => 'ASSIGNED', 'businessId' => $business->id, 'assignedAt' => now(), 'scanCount' => 0]);

        $otherToken = $this->token($other);
        $this->postJson('/api/v1/qr-codes/claim', ['code' => 'MK-TAKEN1', 'businessId' => $otherBusiness->id], ['Authorization' => "Bearer {$otherToken}"])
            ->assertStatus(409);
    }

    public function test_a_dealer_can_claim_for_a_business_they_registered_but_not_others(): void
    {
        $dealer = $this->user(['role' => 'DEALER']);
        $stranger = $this->user(['role' => 'BUSINESS_OWNER']);
        $registered = $this->business($stranger, ['createdById' => $dealer->id, 'slug' => 'registered-shop']);
        $unrelated = $this->business($stranger, ['slug' => 'unrelated-shop']);
        ReviewQrCode::create(['code' => 'MK-DEAL01', 'status' => 'UNASSIGNED', 'scanCount' => 0]);
        ReviewQrCode::create(['code' => 'MK-DEAL02', 'status' => 'UNASSIGNED', 'scanCount' => 0]);

        $token = $this->token($dealer);
        $this->postJson('/api/v1/qr-codes/claim', ['code' => 'MK-DEAL01', 'businessId' => $registered->id], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200);
        $this->postJson('/api/v1/qr-codes/claim', ['code' => 'MK-DEAL02', 'businessId' => $unrelated->id], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(403);
    }

    public function test_admin_detaches_a_board_back_to_the_pool(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $qr = ReviewQrCode::create(['code' => 'MK-DETACH', 'status' => 'ASSIGNED', 'businessId' => $business->id, 'assignedAt' => now(), 'scanCount' => 0]);

        $token = $this->token($admin);
        $this->patchJson("/api/v1/admin/qr-codes/{$qr->id}", ['businessId' => null], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)->assertJsonPath('data.status', 'UNASSIGNED');
    }

    public function test_deleting_a_business_releases_its_boards(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $qr = ReviewQrCode::create(['code' => 'MK-RELEAS', 'status' => 'ASSIGNED', 'businessId' => $business->id, 'assignedAt' => now(), 'scanCount' => 0]);

        $token = $this->token($owner);
        $this->deleteJson("/api/v1/businesses/{$business->id}", [], ['Authorization' => "Bearer {$token}"])->assertStatus(204);

        $qr->refresh();
        $this->assertSame('UNASSIGNED', $qr->status);
        $this->assertNull($qr->businessId);
    }

    public function test_owner_manages_review_links_and_the_preferred_channel_must_be_configured(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $token = $this->token($owner);

        $this->patchJson("/api/v1/businesses/{$business->id}/review-links", ['preferredReviewChannel' => 'INSTAGRAM'], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(400);

        $this->patchJson("/api/v1/businesses/{$business->id}/review-links", [
            'instagramUsername' => 'myshop', 'preferredReviewChannel' => 'INSTAGRAM',
        ], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)
            ->assertJsonPath('data.resolved.INSTAGRAM', 'https://www.instagram.com/myshop/')
            ->assertJsonPath('data.preferredReviewChannel', 'INSTAGRAM');
    }

    public function test_scanning_an_assigned_board_redirects_to_its_channel(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner, ['instagramUsername' => 'myshop']);
        ReviewQrCode::create(['code' => 'MK-SCAN01', 'status' => 'ASSIGNED', 'businessId' => $business->id, 'channel' => 'INSTAGRAM', 'assignedAt' => now(), 'scanCount' => 0]);

        $response = $this->get('/r/q/mk-scan01');
        $response->assertRedirect('https://www.instagram.com/myshop/');

        $this->assertDatabaseHas('review_scans', ['businessId' => $business->id, 'channel' => 'INSTAGRAM']);
        $this->assertSame(1, ReviewQrCode::where('code', 'MK-SCAN01')->first()->scanCount);
    }

    public function test_scanning_an_unclaimed_board_sends_the_shop_to_the_claim_screen(): void
    {
        ReviewQrCode::create(['code' => 'MK-UNCLM1', 'status' => 'UNASSIGNED', 'scanCount' => 0]);

        $this->get('/r/q/MK-UNCLM1')->assertRedirect(config('frontend.origin').'/qr/MK-UNCLM1');
    }

    public function test_scanning_an_unknown_code_redirects_with_the_unknown_flag(): void
    {
        $this->get('/r/q/MK-NOPE01')->assertRedirect(config('frontend.origin').'/qr/MK-NOPE01?unknown=1');
    }
}
