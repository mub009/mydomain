<?php

namespace Tests\Feature;

use App\Models\ClassifiedCategory;
use App\Models\ClassifiedListing;
use App\Models\ClassifiedListingPhoto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ExpireClassifiedListingsTest extends TestCase
{
    use RefreshDatabase;

    private function listing(array $overrides = []): ClassifiedListing
    {
        $seller = User::create([
            'email' => 'seller'.uniqid().'@example.com',
            'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'Test', 'lastName' => 'Seller', 'role' => 'CUSTOMER', 'status' => 'ACTIVE',
        ]);
        $category = ClassifiedCategory::firstOrCreate(['slug' => 'mobiles'], ['name' => 'Mobiles']);

        $listing = ClassifiedListing::create([
            'sellerId' => $seller->id,
            'categoryId' => $category->id,
            'title' => 'Old Listing',
            'slug' => 'old-listing-'.uniqid(),
            'condition' => 'USED',
            'priceCents' => 100000,
            'city' => 'Malappuram',
            'contactPhone' => '9998887777',
            'status' => 'ACTIVE',
            'expiresAt' => now()->subDay(),
            ...$overrides,
        ]);
        ClassifiedListingPhoto::create(['listingId' => $listing->id, 'url' => 'https://cdn.example.com/a.jpg', 'sortOrder' => 0]);

        return $listing;
    }

    public function test_it_expires_active_listings_past_their_expiry_date(): void
    {
        $listing = $this->listing();

        $this->artisan('classifieds:expire')->assertExitCode(0);

        $this->assertSame('EXPIRED', $listing->fresh()->status);
    }

    public function test_it_leaves_the_photo_intact_so_the_listing_can_still_be_renewed(): void
    {
        $listing = $this->listing();

        $this->artisan('classifieds:expire');

        $this->assertDatabaseCount('classified_listing_photos', 1);
        $this->assertDatabaseHas('classified_listing_photos', ['listingId' => $listing->id]);
    }

    public function test_it_does_not_touch_listings_that_are_not_yet_expired(): void
    {
        $listing = $this->listing(['expiresAt' => now()->addDay()]);

        $this->artisan('classifieds:expire');

        $this->assertSame('ACTIVE', $listing->fresh()->status);
    }

    public function test_it_does_not_touch_listings_that_are_already_in_a_non_active_status(): void
    {
        $listing = $this->listing(['status' => 'PAUSED']);

        $this->artisan('classifieds:expire');

        $this->assertSame('PAUSED', $listing->fresh()->status);
    }
}
