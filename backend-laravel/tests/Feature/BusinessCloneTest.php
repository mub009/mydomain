<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\BusinessHours;
use App\Models\BusinessPhoto;
use App\Models\BusinessSite;
use App\Models\Category;
use App\Models\Product;
use App\Models\Review;
use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

// Dealers can make a draft copy of a listing they manage.
class BusinessCloneTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $overrides = []): User
    {
        return User::create([
            'email' => 'user'.uniqid().'@example.com',
            'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'Test', 'lastName' => 'User', 'status' => 'ACTIVE',
            ...$overrides,
        ]);
    }

    private function auth(User $user): array
    {
        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!'])->json('data.accessToken');

        return ['Authorization' => "Bearer {$token}"];
    }

    private function business(User $creator, array $overrides = []): Business
    {
        $category = Category::firstOrCreate(['slug' => 'restaurants'], ['name' => 'Restaurants']);

        return Business::create([
            'ownerId' => $creator->id, 'createdById' => $creator->id, 'name' => 'Spice Route', 'slug' => 'spice-'.uniqid(),
            'categoryId' => $category->id, 'status' => 'PUBLISHED', 'isVerified' => true, 'phone' => '+91 98765 43210',
            'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001',
            'latitude' => 18.5, 'longitude' => 73.8, 'googleReviewUrl' => 'https://g.page/r/original',
            'avgRating' => 4.5, 'reviewCount' => 3, 'viewCount' => 99,
            ...$overrides,
        ]);
    }

    private function dealer(int $points = 5): User
    {
        return $this->user(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => $points]);
    }

    public function test_a_dealer_clones_a_listing_into_a_draft_copy(): void
    {
        $dealer = $this->dealer();
        $source = $this->business($dealer);
        BusinessPhoto::create(['businessId' => $source->id, 'url' => 'https://cdn.example.com/p.jpg', 'sortOrder' => 0]);
        BusinessHours::create(['businessId' => $source->id, 'dayOfWeek' => 1, 'openTime' => '09:00', 'closeTime' => '18:00', 'isClosed' => false]);
        Service::create(['businessId' => $source->id, 'name' => 'Catering', 'priceCents' => 50000]);
        Product::create(['businessId' => $source->id, 'name' => 'Dosa', 'slug' => 'dosa', 'priceCents' => 12000]);
        BusinessSite::create(['businessId' => $source->id, 'templateId' => 'showcase', 'html' => '<h1>Hi</h1>', 'isPublished' => true,
            'sliderImages' => ['https://cdn.example.com/s.jpg'], 'galleryImages' => ['https://cdn.example.com/g.jpg']]);
        Review::create(['businessId' => $source->id, 'userId' => $dealer->id, 'rating' => 5, 'comment' => 'Great']);

        $copy = $this->postJson("/api/v1/businesses/{$source->id}/clone", [], $this->auth($dealer))
            ->assertCreated()
            ->assertJsonPath('data.name', 'Spice Route (Copy)')
            ->assertJsonPath('data.status', 'DRAFT')
            ->json('data');

        $this->assertNotSame($source->slug, $copy['slug']);
        $clone = Business::find($copy['id']);
        $this->assertSame($dealer->id, $clone->ownerId);
        $this->assertNull($clone->googleReviewUrl);
        $this->assertSame(0, (int) $clone->reviewCount);
        $this->assertSame(1, BusinessPhoto::where('businessId', $clone->id)->count());
        $this->assertSame(1, BusinessHours::where('businessId', $clone->id)->count());
        $this->assertSame('Catering', Service::where('businessId', $clone->id)->value('name'));
        $this->assertSame('dosa', Product::where('businessId', $clone->id)->value('slug'));
        $this->assertSame(0, Review::where('businessId', $clone->id)->count());

        $site = BusinessSite::where('businessId', $clone->id)->first();
        $this->assertSame('showcase', $site->templateId);
        $this->assertFalse($site->isPublished);
        $this->assertSame(['https://cdn.example.com/g.jpg'], $site->galleryImages);

        $this->assertSame(4, $dealer->fresh()->points);
        // The original is untouched.
        $this->assertSame('PUBLISHED', $source->fresh()->status);
        $this->assertSame(1, BusinessPhoto::where('businessId', $source->id)->count());

        // The dealer publishes the draft straight away, as with a new listing.
        $this->postJson("/api/v1/businesses/{$clone->id}/submit", [], $this->auth($dealer))->assertOk();
        $this->assertSame('PUBLISHED', $clone->fresh()->status);
    }

    public function test_only_dealers_can_clone(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $admin = $this->user(['role' => 'ADMIN']);
        $source = $this->business($owner);

        $this->postJson("/api/v1/businesses/{$source->id}/clone", [], $this->auth($owner))->assertForbidden();
        $this->postJson("/api/v1/businesses/{$source->id}/clone", [], $this->auth($admin))->assertForbidden();
        $this->assertSame(1, Business::count());
    }

    public function test_a_dealer_can_only_clone_listings_they_manage_and_needs_a_point(): void
    {
        $dealer = $this->dealer();
        $someoneElses = $this->business($this->user(['role' => 'BUSINESS_OWNER']));
        $this->postJson("/api/v1/businesses/{$someoneElses->id}/clone", [], $this->auth($dealer))->assertForbidden();

        $broke = $this->dealer(0);
        $own = $this->business($broke);
        $this->postJson("/api/v1/businesses/{$own->id}/clone", [], $this->auth($broke))->assertForbidden();
        $this->assertSame(2, Business::count());

        $this->postJson('/api/v1/businesses/no-such-id/clone', [], $this->auth($dealer))->assertNotFound();
    }
}
