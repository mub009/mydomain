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
}
