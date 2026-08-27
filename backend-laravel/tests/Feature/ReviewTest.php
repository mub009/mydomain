<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ReviewTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $user): string
    {
        return $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!'])
            ->json('data.accessToken');
    }

    private function user(array $overrides = []): User
    {
        return User::create([
            'email' => $overrides['email'] ?? 'user'.uniqid().'@example.com',
            'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'Test', 'lastName' => 'User', 'status' => 'ACTIVE',
            ...$overrides,
        ]);
    }

    private function business(User $owner): Business
    {
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);

        return Business::create([
            'ownerId' => $owner->id, 'name' => 'Shop', 'slug' => 'shop', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '9998887777', 'addressLine1' => '1 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ]);
    }

    public function test_a_customer_can_review_a_business_once(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $customer = $this->user(['role' => 'CUSTOMER']);
        $business = $this->business($owner);
        $token = $this->token($customer);

        $this->postJson("/api/v1/businesses/{$business->id}/reviews", ['rating' => 5, 'comment' => 'Great'], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(201)->assertJsonPath('data.rating', 5);

        $this->postJson("/api/v1/businesses/{$business->id}/reviews", ['rating' => 3], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(409)->assertJsonPath('error.code', 'CONFLICT');

        $business->refresh();
        $this->assertSame(5.0, $business->avgRating);
        $this->assertSame(1, $business->reviewCount);
    }

    public function test_only_the_business_owner_can_reply_to_a_review(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $customer = $this->user(['role' => 'CUSTOMER']);
        $other = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $customerToken = $this->token($customer);

        $review = $this->postJson("/api/v1/businesses/{$business->id}/reviews", ['rating' => 4], ['Authorization' => "Bearer {$customerToken}"])
            ->json('data');

        $otherToken = $this->token($other);
        $this->postJson("/api/v1/reviews/{$review['id']}/reply", ['ownerReply' => 'Thanks!'], ['Authorization' => "Bearer {$otherToken}"])
            ->assertStatus(403);

        $ownerToken = $this->token($owner);
        $this->postJson("/api/v1/reviews/{$review['id']}/reply", ['ownerReply' => 'Thanks!'], ['Authorization' => "Bearer {$ownerToken}"])
            ->assertStatus(200)->assertJsonPath('data.ownerReply', 'Thanks!');
    }
}
