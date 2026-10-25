<?php

namespace Tests\Feature;

use App\Models\ClassifiedCategory;
use App\Models\ClassifiedListing;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ClassifiedMessagingTest extends TestCase
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

    private function listing(string $sellerId): ClassifiedListing
    {
        $category = ClassifiedCategory::firstOrCreate(['slug' => 'mobiles'], ['name' => 'Mobiles']);

        return ClassifiedListing::create([
            'sellerId' => $sellerId,
            'categoryId' => $category->id,
            'title' => 'iPhone 15 Pro 256GB',
            'slug' => 'iphone-15-pro-'.uniqid(),
            'description' => 'Used iPhone in excellent condition.',
            'condition' => 'USED',
            'priceCents' => 6500000,
            'city' => 'Malappuram',
            'state' => 'Kerala',
            'contactPhone' => '9998887777',
            'status' => 'ACTIVE',
        ]);
    }

    public function test_a_buyer_can_message_a_seller_about_a_listing(): void
    {
        [$seller] = $this->actingToken(['role' => 'CUSTOMER']);
        $listing = $this->listing($seller->id);
        [, $buyerToken] = $this->actingToken(['role' => 'CUSTOMER']);

        $response = $this->postJson("/api/v1/classifieds/{$listing->id}/messages", ['body' => 'Is this still available?'], ['Authorization' => "Bearer {$buyerToken}"]);

        $response->assertStatus(201)->assertJsonPath('data.listing.id', $listing->id);
    }

    public function test_a_seller_cannot_message_themselves_about_their_own_listing(): void
    {
        [$seller, $sellerToken] = $this->actingToken(['role' => 'CUSTOMER']);
        $listing = $this->listing($seller->id);

        $this->postJson("/api/v1/classifieds/{$listing->id}/messages", ['body' => 'Hello'], ['Authorization' => "Bearer {$sellerToken}"])
            ->assertStatus(400);
    }

    public function test_messaging_again_reuses_the_same_conversation_thread(): void
    {
        [$seller] = $this->actingToken(['role' => 'CUSTOMER']);
        $listing = $this->listing($seller->id);
        [, $buyerToken] = $this->actingToken(['role' => 'CUSTOMER']);

        $first = $this->postJson("/api/v1/classifieds/{$listing->id}/messages", ['body' => 'First message'], ['Authorization' => "Bearer {$buyerToken}"]);
        $second = $this->postJson("/api/v1/classifieds/{$listing->id}/messages", ['body' => 'Second message'], ['Authorization' => "Bearer {$buyerToken}"]);

        $this->assertSame($first->json('data.id'), $second->json('data.id'));
    }

    public function test_the_conversation_returned_by_store_and_by_messages_both_carry_the_other_party(): void
    {
        [$seller] = $this->actingToken(['role' => 'CUSTOMER']);
        $listing = $this->listing($seller->id);
        [$buyer, $buyerToken] = $this->actingToken(['role' => 'CUSTOMER']);

        $store = $this->postJson("/api/v1/classifieds/{$listing->id}/messages", ['body' => 'Hi'], ['Authorization' => "Bearer {$buyerToken}"]);
        $store->assertJsonPath('data.role', 'buyer')
            ->assertJsonPath('data.otherParty.id', $seller->id)
            ->assertJsonPath('data.lastMessage', 'Hi');
        $conversationId = $store->json('data.id');

        $thread = $this->getJson("/api/v1/classifieds/conversations/{$conversationId}/messages", ['Authorization' => "Bearer {$buyerToken}"]);
        $thread->assertJsonPath('conversation.role', 'buyer')
            ->assertJsonPath('conversation.otherParty.id', $seller->id);
    }

    public function test_seller_sees_the_conversation_in_their_inbox_and_can_reply(): void
    {
        [$seller, $sellerToken] = $this->actingToken(['role' => 'CUSTOMER']);
        $listing = $this->listing($seller->id);
        [, $buyerToken] = $this->actingToken(['role' => 'CUSTOMER']);

        $this->postJson("/api/v1/classifieds/{$listing->id}/messages", ['body' => 'Is this still available?'], ['Authorization' => "Bearer {$buyerToken}"]);

        $inbox = $this->getJson('/api/v1/classifieds/conversations', ['Authorization' => "Bearer {$sellerToken}"]);
        $inbox->assertStatus(200)->assertJsonCount(1, 'data');
        $conversationId = $inbox->json('data.0.id');
        $this->assertTrue($inbox->json('data.0.unread'));

        $this->postJson("/api/v1/classifieds/conversations/{$conversationId}/messages", ['body' => 'Yes, still available.'], ['Authorization' => "Bearer {$sellerToken}"])
            ->assertStatus(201);

        $thread = $this->getJson("/api/v1/classifieds/conversations/{$conversationId}/messages", ['Authorization' => "Bearer {$buyerToken}"]);
        $thread->assertStatus(200)->assertJsonCount(2, 'data');
    }

    public function test_someone_outside_the_conversation_cannot_read_or_reply_to_it(): void
    {
        [$seller] = $this->actingToken(['role' => 'CUSTOMER']);
        $listing = $this->listing($seller->id);
        [, $buyerToken] = $this->actingToken(['role' => 'CUSTOMER']);
        [, $strangerToken] = $this->actingToken(['role' => 'CUSTOMER']);

        $store = $this->postJson("/api/v1/classifieds/{$listing->id}/messages", ['body' => 'Hi'], ['Authorization' => "Bearer {$buyerToken}"]);
        $conversationId = $store->json('data.id');

        $this->getJson("/api/v1/classifieds/conversations/{$conversationId}/messages", ['Authorization' => "Bearer {$strangerToken}"])
            ->assertStatus(403);
        $this->postJson("/api/v1/classifieds/conversations/{$conversationId}/messages", ['body' => 'Hi'], ['Authorization' => "Bearer {$strangerToken}"])
            ->assertStatus(403);
    }

    public function test_marking_a_conversation_read_clears_the_unread_count(): void
    {
        [$seller, $sellerToken] = $this->actingToken(['role' => 'CUSTOMER']);
        $listing = $this->listing($seller->id);
        [, $buyerToken] = $this->actingToken(['role' => 'CUSTOMER']);

        $store = $this->postJson("/api/v1/classifieds/{$listing->id}/messages", ['body' => 'Hi'], ['Authorization' => "Bearer {$buyerToken}"]);
        $conversationId = $store->json('data.id');

        $this->getJson('/api/v1/classifieds/conversations/unread-count', ['Authorization' => "Bearer {$sellerToken}"])
            ->assertJsonPath('data.count', 1);

        $this->postJson("/api/v1/classifieds/conversations/{$conversationId}/read", [], ['Authorization' => "Bearer {$sellerToken}"])
            ->assertStatus(200);

        $this->getJson('/api/v1/classifieds/conversations/unread-count', ['Authorization' => "Bearer {$sellerToken}"])
            ->assertJsonPath('data.count', 0);
    }

    public function test_follow_and_unfollow_a_seller_is_idempotent(): void
    {
        [$seller] = $this->actingToken(['role' => 'CUSTOMER']);
        [, $followerToken] = $this->actingToken(['role' => 'CUSTOMER']);

        $this->postJson("/api/v1/classifieds/sellers/{$seller->id}/follow", [], ['Authorization' => "Bearer {$followerToken}"])
            ->assertStatus(201);
        $this->postJson("/api/v1/classifieds/sellers/{$seller->id}/follow", [], ['Authorization' => "Bearer {$followerToken}"])
            ->assertStatus(201);

        $status = $this->getJson("/api/v1/classifieds/sellers/{$seller->id}/follow", ['Authorization' => "Bearer {$followerToken}"]);
        $status->assertJsonPath('data.following', true)->assertJsonPath('data.followerCount', 1);

        $this->getJson('/api/v1/classifieds/following', ['Authorization' => "Bearer {$followerToken}"])
            ->assertJsonCount(1, 'data');

        $this->deleteJson("/api/v1/classifieds/sellers/{$seller->id}/follow", [], ['Authorization' => "Bearer {$followerToken}"])
            ->assertStatus(204);

        $this->getJson("/api/v1/classifieds/sellers/{$seller->id}/follow", ['Authorization' => "Bearer {$followerToken}"])
            ->assertJsonPath('data.following', false)->assertJsonPath('data.followerCount', 0);
    }

    public function test_follow_status_is_visible_to_a_guest_as_not_following(): void
    {
        [$seller] = $this->actingToken(['role' => 'CUSTOMER']);

        $this->getJson("/api/v1/classifieds/sellers/{$seller->id}/follow")
            ->assertStatus(200)
            ->assertJsonPath('data.following', false);
    }

    public function test_a_seller_cannot_follow_themselves(): void
    {
        [$seller, $sellerToken] = $this->actingToken(['role' => 'CUSTOMER']);

        $this->postJson("/api/v1/classifieds/sellers/{$seller->id}/follow", [], ['Authorization' => "Bearer {$sellerToken}"])
            ->assertStatus(400);
    }

    public function test_a_user_can_report_a_listing_and_an_admin_can_review_it(): void
    {
        [$seller] = $this->actingToken(['role' => 'CUSTOMER']);
        $listing = $this->listing($seller->id);
        [, $reporterToken] = $this->actingToken(['role' => 'CUSTOMER']);
        [, $adminToken] = $this->actingToken(['role' => 'ADMIN']);

        $report = $this->postJson("/api/v1/classifieds/{$listing->id}/reports", [
            'reason' => 'SCAM_FRAUD',
            'message' => 'Seller asked for advance payment outside the app.',
        ], ['Authorization' => "Bearer {$reporterToken}"]);
        $report->assertStatus(201)->assertJsonPath('data.status', 'PENDING');
        $reportId = $report->json('data.id');

        $queue = $this->getJson('/api/v1/admin/classifieds/reports?status=PENDING', ['Authorization' => "Bearer {$adminToken}"]);
        $queue->assertStatus(200)->assertJsonCount(1, 'data');

        $this->patchJson("/api/v1/admin/classifieds/reports/{$reportId}", ['status' => 'REVIEWED'], ['Authorization' => "Bearer {$adminToken}"])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'REVIEWED');
    }

    public function test_a_non_admin_cannot_view_the_reports_queue(): void
    {
        [, $token] = $this->actingToken(['role' => 'CUSTOMER']);

        $this->getJson('/api/v1/admin/classifieds/reports', ['Authorization' => "Bearer {$token}"])
            ->assertStatus(403);
    }
}
