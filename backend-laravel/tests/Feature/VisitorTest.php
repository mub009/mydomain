<?php

namespace Tests\Feature;

use App\Models\Visitor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class VisitorTest extends TestCase
{
    use RefreshDatabase;

    public function test_capturing_a_visitor_normalizes_the_phone_and_requires_consent(): void
    {
        $this->postJson('/api/v1/visitors', ['phone' => '+919876543210', 'consent' => true])
            ->assertStatus(201)
            ->assertJsonPath('data.phone', '9876543210');

        $this->postJson('/api/v1/visitors', ['phone' => '9876543210', 'consent' => false])
            ->assertStatus(400);
    }

    public function test_revisiting_bumps_the_counter_instead_of_duplicating(): void
    {
        $this->postJson('/api/v1/visitors', ['phone' => '9876543210', 'consent' => true])->assertStatus(201);
        $this->postJson('/api/v1/visitors', ['phone' => '9876543210', 'consent' => true])->assertStatus(201);

        $this->assertSame(1, Visitor::count());
        $this->assertSame(2, Visitor::first()->visitCount);
    }

    public function test_updating_location_requires_an_existing_visitor(): void
    {
        $this->patchJson('/api/v1/visitors/nonexistent-id/location', ['latitude' => 1, 'longitude' => 1])
            ->assertStatus(404);

        $visitor = $this->postJson('/api/v1/visitors', ['phone' => '9876543210', 'consent' => true])->json('data');

        $this->patchJson("/api/v1/visitors/{$visitor['id']}/location", ['latitude' => 12.9, 'longitude' => 77.6, 'city' => 'Bengaluru'])
            ->assertStatus(200)->assertJsonPath('data.located', true);
    }

    public function test_only_an_admin_can_list_visitors(): void
    {
        $admin = \App\Models\User::create([
            'email' => 'admin@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'A', 'lastName' => 'B', 'role' => 'ADMIN', 'status' => 'ACTIVE',
        ]);
        $customer = \App\Models\User::create([
            'email' => 'c@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'C', 'lastName' => 'D', 'role' => 'CUSTOMER', 'status' => 'ACTIVE',
        ]);
        $this->postJson('/api/v1/visitors', ['phone' => '9876543210', 'consent' => true, 'latitude' => 1, 'longitude' => 1]);

        $customerToken = $this->postJson('/api/v1/auth/login', ['email' => $customer->email, 'password' => 'Password123!'])->json('data.accessToken');
        $this->getJson('/api/v1/admin/visitors', ['Authorization' => "Bearer {$customerToken}"])->assertStatus(403);

        $adminToken = $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => 'Password123!'])->json('data.accessToken');
        $this->getJson('/api/v1/admin/visitors', ['Authorization' => "Bearer {$adminToken}"])
            ->assertStatus(200)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('summary.located', 1);
    }
}
