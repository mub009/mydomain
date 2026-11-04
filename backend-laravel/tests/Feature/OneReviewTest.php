<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

// One Review: one QR code opens a page with every review and social link
// the business has set up; taps on each link are counted for the owner.
class OneReviewTest extends TestCase
{
    use RefreshDatabase;

    private Business $business;

    private string $ownerEmail;

    protected function setUp(): void
    {
        parent::setUp();
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);
        $owner = User::create([
            'email' => 'owner-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'O', 'lastName' => 'W', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER',
        ]);
        $this->ownerEmail = $owner->email;
        $this->business = Business::create([
            'ownerId' => $owner->id, 'name' => 'Spice Garden', 'slug' => 'spice-garden', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '98765 43210', 'addressLine1' => '1 Main St', 'city' => 'Kochi', 'state' => 'KL', 'postalCode' => '682001', 'latitude' => 9.9, 'longitude' => 76.2,
            'googlePlaceId' => 'ChIJ_test_place', 'instagramUsername' => 'spicegarden',
        ]);
    }

    public function test_the_public_page_shows_only_the_links_that_are_set_up(): void
    {
        $this->get('/one/spice-garden')->assertOk()
            ->assertSee('Spice Garden')
            ->assertSee('Review us on Google')
            ->assertSee('search.google.com/local/writereview?placeid=ChIJ_test_place', false)
            ->assertSee('Follow on Instagram')->assertSee('https://www.instagram.com/spicegarden/', false)
            ->assertSee('Chat on WhatsApp')->assertSee('Call us')->assertSee('Get directions')
            ->assertDontSee('Subscribe on YouTube')->assertDontSee('Recommend us on Facebook')->assertDontSee('Visit our website');
        $this->assertSame(1, $this->business->fresh()->oneReviewViews);
    }

    public function test_taps_are_counted_per_link(): void
    {
        $this->postJson('/api/v1/one-review/spice-garden/tap', ['link' => 'GOOGLE'])->assertOk();
        $this->postJson('/api/v1/one-review/spice-garden/tap', ['link' => 'GOOGLE'])->assertOk();
        $this->postJson('/api/v1/one-review/spice-garden/tap', ['link' => 'INSTAGRAM'])->assertOk();
        $this->postJson('/api/v1/one-review/spice-garden/tap', ['link' => 'NOPE'])->assertStatus(400);

        $this->assertSame(['GOOGLE' => 2, 'INSTAGRAM' => 1], $this->business->fresh()->oneReviewTaps);
    }

    public function test_the_page_needs_the_feature_and_a_published_listing(): void
    {
        $this->business->update(['features' => ['WEBSITE']]);
        $this->get('/one/spice-garden')->assertNotFound();
        $this->postJson('/api/v1/one-review/spice-garden/tap', ['link' => 'GOOGLE'])->assertNotFound();

        $this->business->update(['features' => ['ONE_REVIEW'], 'status' => 'DRAFT']);
        $this->get('/one/spice-garden')->assertNotFound();
    }

    public function test_the_dashboard_has_the_one_review_section(): void
    {
        $this->withoutVite();
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $this->get("/dashboard/businesses/{$this->business->id}")->assertOk()->assertSee('One Review');
        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('One Review'))->assertOk()
            ->assertSee('Your One Review page')->assertSee('/one/spice-garden')
            ->assertSee('Not set up yet')->assertSee('Subscribe on YouTube');

        // Without the feature the section isn't offered.
        $this->business->update(['features' => ['WEBSITE']]);
        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('One Review'))->assertOk()
            ->assertDontSee('Your One Review page');
    }
}
