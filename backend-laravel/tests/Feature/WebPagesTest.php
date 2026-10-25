<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\BusinessSite;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Support\VisitorLocation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

// The Blade pages: every page, tab and section renders for the people who
// may see it, and keeps out the people who may not.
class WebPagesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    private function user(array $overrides = []): User
    {
        return User::create([
            'email' => 'user'.uniqid().'@example.com',
            'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'Test', 'lastName' => 'User', 'status' => 'ACTIVE', 'role' => 'CUSTOMER',
            ...$overrides,
        ]);
    }

    private function signIn(User $user): void
    {
        $this->post('/login', ['email' => $user->email, 'password' => 'Password123!'])->assertRedirect('/');
    }

    private function business(User $owner, array $overrides = []): Business
    {
        $category = Category::firstOrCreate(['slug' => 'restaurants'], ['name' => 'Restaurants']);

        return Business::create([
            'ownerId' => $owner->id, 'name' => "Alice's Diner", 'slug' => 'diner-'.uniqid(), 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '+91 98765 43210', 'addressLine1' => '1 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
            ...$overrides,
        ]);
    }

    public function test_public_pages_render(): void
    {
        $business = $this->business($this->user(['role' => 'BUSINESS_OWNER']));

        $this->get('/')->assertOk()->assertSee('Top rated businesses')->assertSee("Alice's Diner");
        $this->get('/search?q=Diner&sort=rating')->assertOk()->assertSee('data-enquiry', false);
        // The unrated listing drops out under a rating filter, and the filter shows as a removable chip.
        $this->get('/search?q=Diner&minRating=3')->assertOk()->assertDontSee('data-enquiry', false)->assertSee('3★ &amp; above', false);
        $this->get('/search?category=restaurants')->assertOk()->assertSee('Popular Restaurants');
        $this->get('/search?category=nope')->assertOk()->assertSee('No businesses found');
        $this->get('/b2b')->assertRedirect('/search?businessType=B2B');
        $this->get("/business/{$business->slug}")->assertOk()->assertSee('Reviews &amp; Ratings', false);
        $this->get("/business/{$business->slug}?review=1")->assertOk()->assertSee('Sign in to leave your review');
        $this->get('/business/does-not-exist')->assertNotFound();
        $this->get('/qr/mk-abc123')->assertOk()->assertSee('"code":"MK-ABC123"', false);
        $this->get('/login')->assertOk();
        $this->get('/register')->assertOk();
    }

    public function test_search_narrows_to_the_location_cookie(): void
    {
        $this->business($this->user(['role' => 'BUSINESS_OWNER']));

        $this->withUnencryptedCookie(VisitorLocation::COOKIE, json_encode(['city' => 'Mumbai', 'geo' => null]))
            ->get('/search')->assertOk()->assertSee('in Mumbai')->assertSee('Only listings in Mumbai are being shown.');
        // (A "near me" point uses MySQL's distance maths, which the SQLite
        // test database can't run, so only the city form is exercised here.)
    }

    public function test_published_sites_render_and_unpublished_ones_say_so(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $website = $this->business($owner);
        $shop = $this->business($owner);
        $hidden = $this->business($owner);

        BusinessSite::create(['businessId' => $website->id, 'siteType' => 'WEBSITE', 'html' => '<h1>Hello there</h1>', 'css' => 'h1{color:red}', 'isPublished' => true]);
        BusinessSite::create(['businessId' => $shop->id, 'siteType' => 'ECOMMERCE', 'templateId' => 'modern', 'isPublished' => true, 'deliveryFeeCents' => 4000]);
        Product::create(['businessId' => $shop->id, 'name' => 'Masala Dosa', 'slug' => 'masala-dosa', 'priceCents' => 12000]);

        $this->get("/site/{$website->slug}")->assertOk()->assertSee('<h1>Hello there</h1>', false)->assertSee('on Markkito');
        $this->get("/site/{$shop->slug}")->assertOk()->assertSee('Delivery ₹40')->assertSee('Masala Dosa');
        $this->get("/site/{$hidden->slug}")->assertNotFound()->assertSee('Website not available');
    }

    public function test_login_register_logout_and_session_token(): void
    {
        $user = $this->user();

        $this->post('/login', ['email' => $user->email, 'password' => 'wrong'])->assertSessionHasErrors('email');
        $this->getJson('/session/token')->assertUnauthorized();

        $this->post('/login', ['email' => $user->email, 'password' => 'Password123!', 'next' => '//evil.test'])->assertRedirect('/');
        $token = $this->getJson('/session/token')->assertOk()->json('accessToken');
        $this->getJson('/api/v1/auth/me', ['Authorization' => "Bearer {$token}"])->assertOk()->assertJsonPath('data.id', $user->id);

        $this->post('/logout')->assertRedirect('/');
        $this->getJson('/session/token')->assertUnauthorized();

        $this->post('/register', ['firstName' => 'New', 'lastName' => 'Owner', 'email' => 'new@example.com', 'password' => 'Password123!', 'role' => 'BUSINESS_OWNER'])
            ->assertRedirect('/');
        $this->assertSame('BUSINESS_OWNER', User::where('email', 'new@example.com')->value('role'));
        $this->get('/dashboard')->assertOk();
    }

    public function test_a_suspended_account_cannot_sign_in(): void
    {
        $user = $this->user(['status' => 'SUSPENDED']);

        $this->post('/login', ['email' => $user->email, 'password' => 'Password123!'])->assertSessionHasErrors('email');
    }

    public function test_dashboards_keep_out_the_wrong_people(): void
    {
        $this->get('/dashboard')->assertRedirect('/login');
        $this->get('/admin')->assertRedirect('/login');

        $this->signIn($this->user(['role' => 'CUSTOMER']));
        $this->get('/dashboard')->assertRedirect('/');
        $this->get('/admin')->assertRedirect('/');
    }

    public function test_owner_dashboard_and_every_manage_section_render(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $other = $this->business($this->user(['role' => 'BUSINESS_OWNER']));
        $this->signIn($owner);

        $this->get('/dashboard')->assertOk()->assertSee('Your listings')->assertSee("/dashboard/businesses/{$business->id}", false);
        $this->get('/dashboard?tab=leads')->assertOk()->assertSee('No leads yet.');
        $this->get('/dashboard?tab=bookings')->assertOk()->assertSee('No bookings yet.');

        foreach (['Details', 'Hours', 'Services', 'Photos', 'Slider', 'Our Gallery', 'Reviews & QR', 'Website', 'Products', 'Orders', 'Customers'] as $section) {
            $this->get("/dashboard/businesses/{$business->id}?section=".urlencode($section))
                ->assertOk()->assertDontSee('Could not', false);
        }

        $this->get("/dashboard/businesses/{$other->id}")->assertForbidden();
        $this->get('/dashboard/businesses/no-such-id')->assertNotFound();
    }

    public function test_dealer_dashboard_follows_privileges(): void
    {
        $dealer = $this->user(['role' => 'DEALER', 'privileges' => ['MANAGE_LEADS'], 'points' => 3]);
        $this->signIn($dealer);

        // No MANAGE_LISTINGS: the listings tab and the manager are off limits.
        $this->get('/dashboard')->assertOk()->assertSee('Points available')->assertDontSee('Your listings');
        $this->get('/dashboard?tab=leads')->assertOk();
        $this->get('/dashboard/businesses/anything')->assertRedirect('/dashboard');
    }

    public function test_admin_console_tabs_render(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $this->business($this->user(['role' => 'DEALER']), ['status' => 'PENDING_APPROVAL']);
        $this->signIn($admin);

        foreach (['Overview', 'Users', 'Businesses', 'Approvals', 'QR Boards', 'Visitors', 'Analytics', 'Reports'] as $tab) {
            $this->get('/admin?tab='.urlencode($tab))->assertOk()->assertDontSee('Could not load', false);
        }
        $this->get('/admin?tab=Users&role=DEALER&search=Test')->assertOk();
        $this->get('/admin/online')->assertOk()->assertHeader('X-Online-Count');
    }
}
