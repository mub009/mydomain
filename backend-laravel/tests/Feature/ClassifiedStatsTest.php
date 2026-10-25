<?php

namespace Tests\Feature;

use App\Models\ClassifiedCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ClassifiedStatsTest extends TestCase
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

    private function category(string $name = 'Mobiles'): ClassifiedCategory
    {
        return ClassifiedCategory::firstOrCreate(['slug' => strtolower($name)], ['name' => $name]);
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
            'photos' => ['https://cdn.example.com/a.jpg'],
            ...$overrides,
        ];
    }

    public function test_a_non_admin_cannot_view_marketplace_stats(): void
    {
        [, $token] = $this->actingToken();
        $this->getJson('/api/v1/admin/classifieds/stats', ['Authorization' => "Bearer {$token}"])->assertStatus(403);
    }

    public function test_marketplace_stats_reflect_real_activity_across_the_marketplace(): void
    {
        [$seller, $sellerToken] = $this->actingToken(['role' => 'CUSTOMER']);
        [$buyer, $buyerToken] = $this->actingToken(['role' => 'CUSTOMER']);
        [, $adminToken] = $this->actingToken(['role' => 'ADMIN']);

        // Two active listings (different categories), one later marked sold.
        $listingA = $this->postJson('/api/v1/classifieds', $this->listingPayload(['title' => 'iPhone', 'categoryId' => $this->category('Mobiles')->id]), ['Authorization' => "Bearer {$sellerToken}"])->json('data.id');
        $listingB = $this->postJson('/api/v1/classifieds', $this->listingPayload(['title' => 'Sofa', 'categoryId' => $this->category('Furniture')->id]), ['Authorization' => "Bearer {$sellerToken}"])->json('data.id');
        $this->postJson("/api/v1/classifieds/{$listingA}/sold", [], ['Authorization' => "Bearer {$sellerToken}"]);

        // A view and a favorite on the still-active listing.
        $this->getJson("/api/v1/classifieds/{$listingB}");
        $this->postJson("/api/v1/classifieds/{$listingB}/favorite", [], ['Authorization' => "Bearer {$buyerToken}"]);

        // A conversation with one reply.
        $conversationId = $this->postJson("/api/v1/classifieds/{$listingB}/messages", ['body' => 'Still available?'], ['Authorization' => "Bearer {$buyerToken}"])->json('data.id');
        $this->postJson("/api/v1/classifieds/conversations/{$conversationId}/messages", ['body' => 'Yes!'], ['Authorization' => "Bearer {$sellerToken}"]);

        // A follow and a report.
        $this->postJson("/api/v1/classifieds/sellers/{$seller->id}/follow", [], ['Authorization' => "Bearer {$buyerToken}"]);
        $this->postJson("/api/v1/classifieds/{$listingB}/reports", ['reason' => 'SPAM'], ['Authorization' => "Bearer {$buyerToken}"]);

        $response = $this->getJson('/api/v1/admin/classifieds/stats', ['Authorization' => "Bearer {$adminToken}"]);

        $response->assertStatus(200)
            ->assertJsonPath('data.listings.total', 2)
            ->assertJsonPath('data.listings.byStatus.ACTIVE', 1)
            ->assertJsonPath('data.listings.byStatus.SOLD', 1)
            ->assertJsonPath('data.listings.postedToday', 2)
            ->assertJsonPath('data.listings.totalViews', 1)
            ->assertJsonPath('data.listings.totalFavorites', 1)
            ->assertJsonPath('data.sellers.totalWithListings', 1)
            ->assertJsonPath('data.sellers.activeSellers', 1)
            ->assertJsonPath('data.messaging.totalConversations', 1)
            ->assertJsonPath('data.messaging.totalMessages', 2)
            ->assertJsonPath('data.follows.total', 1)
            ->assertJsonPath('data.reports.pending', 1);

        $categoryNames = collect($response->json('data.listings.topCategories'))->pluck('name');
        $this->assertTrue($categoryNames->contains('Furniture'));
        $this->assertFalse($categoryNames->contains('Mobiles'), 'the sold iPhone listing should not count toward an active-only top-categories list');
    }
}
