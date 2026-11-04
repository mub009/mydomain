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
            ->assertSee('aria-label="Google"', false)
            ->assertSee('search.google.com/local/writereview?placeid=ChIJ_test_place', false)
            ->assertSee('https://www.instagram.com/spicegarden/', false)
            // Only review and social media links: no contact links.
            ->assertDontSee('https://wa.me/', false)->assertDontSee('tel:', false)->assertDontSee('google.com/maps/dir', false)
            ->assertDontSee('youtube.com', false)->assertDontSee('tiktok.com', false);
        $this->assertSame(1, $this->business->fresh()->oneReviewViews);
    }

    public function test_every_social_network_entered_in_reviews_and_qr_shows_on_the_page(): void
    {
        $token = $this->postJson('/api/v1/auth/login', ['email' => $this->ownerEmail, 'password' => 'Password123!'])->json('data.accessToken');
        $this->patchJson("/api/v1/businesses/{$this->business->id}/review-links", [
            'facebookPageUrl' => 'spicegardenkochi', 'youtubeUrl' => '@spicegarden',
            'socialTiktok' => '@spice.garden', 'socialX' => 'spicegarden', 'socialLinkedin' => 'https://www.linkedin.com/company/spice-garden',
            'socialSnapchat' => 'spicesnap', 'socialThreads' => '@spicegarden', 'socialPinterest' => 'spicegarden', 'socialTelegram' => 'spicegarden',
        ], ['Authorization' => "Bearer {$token}"])->assertOk()->assertJsonPath('data.socialTiktok', '@spice.garden');

        $this->get('/one/spice-garden')->assertOk()
            ->assertSee('https://www.facebook.com/spicegardenkochi/reviews', false)
            ->assertSee('https://www.youtube.com/@spicegarden', false)
            ->assertSee('https://www.tiktok.com/@spice.garden', false)
            ->assertSee('https://x.com/spicegarden', false)
            ->assertSee('https://www.linkedin.com/company/spice-garden', false)
            ->assertSee('https://www.snapchat.com/add/spicesnap', false)
            ->assertSee('https://www.threads.net/@spicegarden', false)
            ->assertSee('https://www.pinterest.com/spicegarden', false)
            ->assertSee('https://t.me/spicegarden', false);

        // Clearing a field removes it.
        $this->patchJson("/api/v1/businesses/{$this->business->id}/review-links", ['socialTiktok' => ''], ['Authorization' => "Bearer {$token}"])->assertOk();
        $this->get('/one/spice-garden')->assertDontSee('tiktok.com', false)->assertSee('https://x.com/spicegarden', false);
    }

    public function test_the_owner_picks_one_of_ten_styles(): void
    {
        $this->assertCount(10, \App\Support\OneReview::STYLES);
        $this->get('/one/spice-garden')->assertSee('class="t-classic"', false);

        $token = $this->postJson('/api/v1/auth/login', ['email' => $this->ownerEmail, 'password' => 'Password123!'])->json('data.accessToken');
        $auth = ['Authorization' => "Bearer {$token}"];
        $this->getJson("/api/v1/businesses/{$this->business->id}/one-review", $auth)->assertOk()
            ->assertJsonPath('data.style', 'classic')->assertJsonCount(10, 'data.styles');
        $this->putJson("/api/v1/businesses/{$this->business->id}/one-review", ['style' => 'gold'], $auth)->assertOk()->assertJsonPath('data.style', 'gold');
        $this->putJson("/api/v1/businesses/{$this->business->id}/one-review", ['style' => 'nope'], $auth)->assertStatus(400);

        $this->get('/one/spice-garden')->assertSee('class="t-gold"', false);
        // The dashboard's Preview shows another style without saving it or counting a visit.
        $views = $this->business->fresh()->oneReviewViews;
        $this->get('/one/spice-garden?style=neon')->assertSee('class="t-neon"', false);
        $this->get('/one/spice-garden?style=bogus')->assertSee('class="t-gold"', false);
        $this->assertSame('gold', $this->business->fresh()->oneReviewStyle);
        $this->assertSame($views + 1, $this->business->fresh()->oneReviewViews);
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
            ->assertSee('Not set up yet')->assertSee('TikTok');

        // Without the feature the section isn't offered.
        $this->business->update(['features' => ['WEBSITE']]);
        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('One Review'))->assertOk()
            ->assertDontSee('Your One Review page');
    }
}
