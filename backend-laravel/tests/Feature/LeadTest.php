<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LeadTest extends TestCase
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

    private function business(User $owner): Business
    {
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);

        return Business::create([
            'ownerId' => $owner->id, 'name' => 'Shop', 'slug' => 'shop', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '9998887777', 'addressLine1' => '1 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ]);
    }

    public function test_an_anonymous_visitor_can_leave_a_lead_and_it_bumps_the_business_lead_count(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);

        $this->postJson("/api/v1/businesses/{$business->id}/leads", [
            'name' => 'Prospect', 'phone' => '9990001111', 'message' => 'Interested',
        ])->assertStatus(201)->assertJsonPath('data.status', 'NEW');

        $this->assertSame(1, $business->fresh()->leadCount);
    }

    public function test_only_the_owner_with_the_manage_leads_privilege_can_list_leads(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $other = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);

        $this->postJson("/api/v1/businesses/{$business->id}/leads", ['name' => 'P', 'phone' => '9990001111']);

        $otherToken = $this->token($other);
        $this->getJson("/api/v1/businesses/{$business->id}/leads", ['Authorization' => "Bearer {$otherToken}"])
            ->assertStatus(403);

        $ownerToken = $this->token($owner);
        $this->getJson("/api/v1/businesses/{$business->id}/leads", ['Authorization' => "Bearer {$ownerToken}"])
            ->assertStatus(200)->assertJsonPath('meta.total', 1);
    }

    public function test_owner_updates_a_lead_status(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $lead = $this->postJson("/api/v1/businesses/{$business->id}/leads", ['name' => 'P', 'phone' => '9990001111'])->json('data');

        $token = $this->token($owner);
        $this->patchJson("/api/v1/leads/{$lead['id']}/status", ['status' => 'CONTACTED'], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)->assertJsonPath('data.status', 'CONTACTED');
    }
}
