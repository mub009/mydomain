<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SearchTest extends TestCase
{
    use RefreshDatabase;

    // Laravel's ConvertEmptyStringsToNull middleware turns "" into null
    // before validation runs. A cleared "All categories" filter (or any
    // other optional text/select filter) posts an empty string, so every
    // optional filter here must tolerate null, not just "absent" — a bare
    // ['sometimes', 'string'] rule rejects null with a confusing "must be a
    // string" error instead of treating it as no filter.
    public function test_empty_string_filters_are_treated_as_no_filter_not_a_validation_error(): void
    {
        $owner = User::create([
            'email' => 'o@example.com', 'passwordHash' => bcrypt('x'),
            'firstName' => 'O', 'lastName' => 'W', 'role' => 'BUSINESS_OWNER', 'status' => 'ACTIVE',
        ]);
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);
        Business::create([
            'ownerId' => $owner->id, 'name' => 'Shop', 'slug' => 'shop', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '9998887777', 'addressLine1' => '1 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ]);

        $this->getJson('/api/v1/search?categorySlug=&city=&q=&sort=&lat=&lng=')
            ->assertStatus(200)
            ->assertJsonPath('meta.total', 1);

        $this->getJson('/api/v1/businesses?categoryId=&city=')
            ->assertStatus(200)
            ->assertJsonPath('meta.total', 1);
    }

    public function test_search_filters_by_business_type(): void
    {
        $owner = User::create([
            'email' => 'o2@example.com', 'passwordHash' => bcrypt('x'),
            'firstName' => 'O', 'lastName' => 'W', 'role' => 'BUSINESS_OWNER', 'status' => 'ACTIVE',
        ]);
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);
        Business::create([
            'ownerId' => $owner->id, 'name' => 'Consumer Diner', 'slug' => 'consumer-diner', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'businessType' => 'B2C', 'phone' => '9998887777', 'addressLine1' => '1 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ]);
        Business::create([
            'ownerId' => $owner->id, 'name' => 'Wholesale Supplier', 'slug' => 'wholesale-supplier', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'businessType' => 'B2B', 'phone' => '9998887778', 'addressLine1' => '2 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ]);

        $b2b = $this->getJson('/api/v1/search?businessType=B2B');
        $b2b->assertStatus(200)->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.slug', 'wholesale-supplier');

        $all = $this->getJson('/api/v1/search');
        $all->assertStatus(200)->assertJsonPath('meta.total', 2);
    }
}
