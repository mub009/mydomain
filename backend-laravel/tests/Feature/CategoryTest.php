<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CategoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_anyone_can_list_and_view_categories(): void
    {
        Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);

        $this->getJson('/api/v1/categories')->assertStatus(200)->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/categories/restaurants')->assertStatus(200)->assertJsonPath('data.name', 'Restaurants');
    }

    public function test_only_an_admin_can_create_a_category(): void
    {
        $customer = User::create([
            'email' => 'c@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'C', 'lastName' => 'D', 'role' => 'CUSTOMER', 'status' => 'ACTIVE',
        ]);
        $customerToken = $this->postJson('/api/v1/auth/login', ['email' => 'c@example.com', 'password' => 'Password123!'])->json('data.accessToken');

        $this->postJson('/api/v1/categories', ['name' => 'Beauty', 'slug' => 'beauty'], ['Authorization' => "Bearer {$customerToken}"])
            ->assertStatus(403);

        $admin = User::create([
            'email' => 'a@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'A', 'lastName' => 'B', 'role' => 'ADMIN', 'status' => 'ACTIVE',
        ]);
        $adminToken = $this->postJson('/api/v1/auth/login', ['email' => 'a@example.com', 'password' => 'Password123!'])->json('data.accessToken');

        $this->postJson('/api/v1/categories', ['name' => 'Beauty', 'slug' => 'beauty'], ['Authorization' => "Bearer {$adminToken}"])
            ->assertStatus(201)->assertJsonPath('data.slug', 'beauty');
    }
}
