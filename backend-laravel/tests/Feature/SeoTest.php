<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\BusinessSite;
use App\Models\Category;
use App\Models\SeoPage;
use App\Models\User;
use App\Support\Seo\SeoTracker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SeoTest extends TestCase
{
    use RefreshDatabase;

    private const EMAIL = 'indexer@markkito-test.iam.gserviceaccount.com';

    private function user(array $overrides = []): User
    {
        return User::create([
            'email' => $overrides['email'] ?? 'user'.uniqid().'@example.com',
            'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'Test', 'lastName' => 'User', 'status' => 'ACTIVE', 'points' => 0,
            ...$overrides,
        ]);
    }

    private function token(User $user): string
    {
        return $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!'])
            ->json('data.accessToken');
    }

    private function business(User $owner, array $overrides = []): Business
    {
        $category = Category::firstOrCreate(['slug' => 'bakeries'], ['name' => 'Bakeries']);

        return Business::create([
            'ownerId' => $owner->id, 'name' => 'Sunrise Bakery', 'slug' => 'sunrise-bakery-'.uniqid(), 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '9998887777', 'addressLine1' => '1 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
            ...$overrides,
        ]);
    }

    // Google switched on, with every endpoint faked. The access token is
    // pre-cached so these tests don't depend on the machine's OpenSSL.
    private function connectGoogle(bool $indexed = true, int $indexingStatus = 200): void
    {
        config([
            'services.google_search.credentials' => json_encode(['client_email' => self::EMAIL, 'private_key' => 'unused']),
            'services.google_search.property' => 'sc-domain:mydomainbook.test',
        ]);
        Cache::put('google-search-token:'.md5(self::EMAIL), 'test-token', now()->addHour());
        Http::fake([
            'indexing.googleapis.com/*' => Http::response($indexingStatus === 200 ? ['urlNotificationMetadata' => []] : ['error' => ['message' => 'Quota exceeded']], $indexingStatus),
            'www.googleapis.com/webmasters/*' => Http::response(null, 204),
            'searchconsole.googleapis.com/*' => Http::response(['inspectionResult' => ['indexStatusResult' => $indexed
                ? ['verdict' => 'PASS', 'coverageState' => 'Submitted and indexed', 'lastCrawlTime' => '2026-10-25T08:00:00Z']
                : ['verdict' => 'NEUTRAL', 'coverageState' => 'Discovered - currently not indexed']]]),
        ]);
    }

    public function test_going_live_tracks_the_listing_and_website_and_coming_down_drops_them(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $draft = $this->business($owner, ['status' => 'DRAFT']);
        $this->assertSame(0, SeoPage::where('businessId', $draft->id)->count());

        $draft->update(['status' => 'PUBLISHED']);
        $pages = SeoPage::where('businessId', $draft->id)->get()->keyBy('kind');
        $this->assertSame(rtrim(config('app.url'), '/')."/business/{$draft->slug}", $pages['LISTING']->url);
        $this->assertSame("https://{$draft->slug}.mydomainbook.test/", $pages['WEBSITE']->url);
        $this->assertTrue($pages['LISTING']->needsSubmit);

        // A shop that isn't open yet has no live website.
        BusinessSite::create(['businessId' => $draft->id, 'siteType' => 'ECOMMERCE', 'isPublished' => false]);
        $this->assertEqualsCanonicalizing(['LISTING'], SeoPage::where('businessId', $draft->id)->pluck('kind')->all());

        $draft->update(['status' => 'SUSPENDED']);
        $this->assertSame(0, SeoPage::where('businessId', $draft->id)->count());
    }

    public function test_owner_saves_seo_text_and_sees_checklist_and_google_status(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        SeoPage::where('businessId', $business->id)->update(['needsSubmit' => false]);
        $token = $this->token($owner);

        $this->patchJson("/api/v1/businesses/{$business->id}", ['seoTitle' => str_repeat('x', 71)], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(400);

        $this->patchJson("/api/v1/businesses/{$business->id}", [
            'seoTitle' => 'Sunrise Bakery — fresh cakes in Pune',
            'seoDescription' => 'Birthday cakes, breads and pastries baked fresh every morning. Order online or visit us on Main Street.',
            'seoKeywords' => 'bakery, cakes, Pune',
        ], ['Authorization' => "Bearer {$token}"])->assertOk();
        // New text means Google should look again.
        $this->assertTrue(SeoPage::where('businessId', $business->id)->where('needsSubmit', true)->exists());

        $this->getJson("/api/v1/businesses/{$business->id}/seo", ['Authorization' => "Bearer {$token}"])
            ->assertOk()
            ->assertJsonPath('data.preview.title', 'Sunrise Bakery — fresh cakes in Pune')
            ->assertJsonPath('data.googleConnected', false)
            ->assertJsonCount(2, 'data.pages')
            ->assertJsonPath('data.pages.0.stage', 'WAITING')
            ->assertJsonPath('data.checklist.1.ok', true);

        $stranger = $this->token($this->user(['role' => 'BUSINESS_OWNER']));
        $this->getJson("/api/v1/businesses/{$business->id}/seo", ['Authorization' => "Bearer {$stranger}"])->assertForbidden();
    }

    public function test_public_pages_carry_search_tags(): void
    {
        $business = $this->business($this->user(['role' => 'BUSINESS_OWNER']), [
            'seoTitle' => 'Best cakes in Pune', 'seoDescription' => 'Fresh every morning.', 'seoKeywords' => 'cakes, Pune',
        ]);

        $this->get("/business/{$business->slug}")->assertOk()
            ->assertSee('<title>Best cakes in Pune · Markkito', false)
            ->assertSee('<meta name="description" content="Fresh every morning." />', false)
            ->assertSee('<meta name="keywords" content="cakes, Pune" />', false)
            ->assertSee('<link rel="canonical" href="'.SeoTracker::listingUrl($business->slug).'" />', false)
            ->assertSee('"@type":"LocalBusiness"', false);

        $this->get("/site/{$business->slug}")->assertOk()
            ->assertSee('<link rel="canonical" href="https://'.$business->slug.'.mydomainbook.test/" />', false)
            ->assertSee('"addressLocality":"Pune"', false);

        // Work screens stay out of Google.
        $this->get('/login')->assertSee('<meta name="robots" content="noindex, nofollow" />', false);
        $this->get('/')->assertDontSee('name="robots"', false);
    }

    public function test_sitemap_lists_live_pages_and_robots_points_at_it(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $live = $this->business($owner);
        $draft = $this->business($owner, ['status' => 'DRAFT']);

        $this->get('/sitemap.xml')->assertOk()
            ->assertHeader('Content-Type', 'application/xml; charset=UTF-8')
            ->assertSee("/business/{$live->slug}</loc>", false)
            ->assertSee("https://{$live->slug}.mydomainbook.test/</loc>", false)
            ->assertDontSee($draft->slug);

        $this->get('/robots.txt')->assertOk()
            ->assertSee('Sitemap: '.rtrim(config('app.url'), '/').'/sitemap.xml')
            ->assertSee('Disallow: /admin');
    }

    public function test_sync_submits_new_pages_and_records_what_google_says(): void
    {
        $business = $this->business($this->user(['role' => 'BUSINESS_OWNER']));
        $this->connectGoogle();

        $this->artisan('seo:sync')->expectsOutputToContain('Submitted 2, checked 2')->assertSuccessful();

        Http::assertSent(fn (HttpRequest $r) => str_contains($r->url(), 'urlNotifications:publish')
            && $r['url'] === SeoTracker::listingUrl($business->slug) && $r['type'] === 'URL_UPDATED'
            && $r->hasHeader('Authorization', 'Bearer test-token'));
        Http::assertSent(fn (HttpRequest $r) => str_contains($r->url(), '/sitemaps/'));

        $page = SeoPage::where('businessId', $business->id)->where('kind', 'LISTING')->first();
        $this->assertFalse($page->needsSubmit);
        $this->assertSame(1, $page->submitCount);
        $this->assertSame('INDEXED', $page->indexStatus);
        $this->assertSame('Submitted and indexed', $page->coverageState);
        $this->assertSame('INDEXED', $page->stage());
        $this->assertNotNull($page->indexedAt);
    }

    public function test_pages_still_missing_after_two_days_are_overdue_and_resubmitted(): void
    {
        $business = $this->business($this->user(['role' => 'BUSINESS_OWNER']));
        $this->connectGoogle(indexed: false);
        $this->artisan('seo:sync')->assertSuccessful();

        $page = SeoPage::where('businessId', $business->id)->where('kind', 'LISTING')->first();
        $this->assertSame('NOT_INDEXED', $page->indexStatus);
        $this->assertSame('WAITING', $page->stage());

        $this->travel(SeoPage::TARGET_HOURS + 1)->hours();
        $this->assertSame('OVERDUE', $page->fresh()->stage());
        $this->connectGoogle(indexed: false); // the cached token has expired by now
        $this->artisan('seo:sync')->assertSuccessful();
        $this->assertSame(2, $page->fresh()->submitCount);
    }

    public function test_a_quota_error_is_kept_and_stops_the_run(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $this->business($owner);
        $this->business($owner);
        $this->connectGoogle(indexingStatus: 429);

        $this->artisan('seo:sync')->assertSuccessful();

        // One attempt, then it stops for the day; nothing is lost from the queue.
        Http::assertSentCount(2); // the sitemap + one notice
        $this->assertSame(4, SeoPage::where('needsSubmit', true)->count());
        $this->assertStringContainsString('Quota exceeded', SeoPage::whereNotNull('submitError')->first()->submitError);
    }

    public function test_sync_without_google_only_tracks_existing_listings(): void
    {
        $business = $this->business($this->user(['role' => 'BUSINESS_OWNER']));
        SeoPage::query()->delete();
        Http::fake();

        $this->artisan('seo:sync')->expectsOutputToContain('Started tracking 1')->expectsOutputToContain('not connected')->assertSuccessful();

        $this->assertSame(2, SeoPage::where('businessId', $business->id)->count());
        Http::assertNothingSent();
    }

    public function test_admin_report_counts_stages_and_filters(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $old = $this->business($owner, ['name' => 'Old Bakery']);
        SeoPage::where('businessId', $old->id)->update(['createdAt' => now()->subDays(3)]);
        $indexed = $this->business($owner, ['name' => 'Famous Bakery']);
        SeoPage::where('businessId', $indexed->id)->update(['indexStatus' => 'INDEXED', 'indexedAt' => now()->addHours(5)]);
        $this->business($owner, ['name' => 'New Bakery']);

        $token = $this->token($this->user(['role' => 'ADMIN']));
        $headers = ['Authorization' => "Bearer {$token}"];
        $this->getJson('/api/v1/admin/seo', $headers)->assertOk()
            ->assertJsonPath('meta.summary.total', 6)
            ->assertJsonPath('meta.summary.indexed', 2)
            ->assertJsonPath('meta.summary.waiting', 2)
            ->assertJsonPath('meta.summary.overdue', 2)
            ->assertJsonPath('meta.summary.indexedInTarget', 2)
            // Overdue rows come first.
            ->assertJsonPath('data.0.business.name', 'Old Bakery');

        $this->getJson('/api/v1/admin/seo?stage=OVERDUE&kind=LISTING', $headers)->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.stage', 'OVERDUE');

        // Check/resubmit need Google to be connected.
        $pageId = SeoPage::where('businessId', $old->id)->value('id');
        $this->postJson("/api/v1/admin/seo/pages/{$pageId}/check", [], $headers)->assertStatus(400);

        $this->connectGoogle();
        $this->postJson("/api/v1/admin/seo/pages/{$pageId}/check", [], $headers)->assertOk()->assertJsonPath('data.indexStatus', 'INDEXED');
        $this->postJson("/api/v1/admin/seo/pages/{$pageId}/submit", [], $headers)->assertOk()->assertJsonPath('data.submitCount', 1);

        $customer = $this->token($this->user(['role' => 'CUSTOMER']));
        $this->getJson('/api/v1/admin/seo', ['Authorization' => "Bearer {$customer}"])->assertForbidden();
    }

    public function test_service_account_token_is_signed_and_exchanged(): void
    {
        $pem = null;
        foreach ([[], ['config' => dirname(PHP_BINARY).'/extras/ssl/openssl.cnf']] as $extra) {
            $key = @openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA, ...$extra]);
            if ($key && openssl_pkey_export($key, $pem, null, $extra)) {
                break;
            }
            $pem = null;
        }
        if (! $pem) {
            $this->markTestSkipped('OpenSSL cannot create keys on this machine');
        }

        $business = $this->business($this->user(['role' => 'BUSINESS_OWNER']));
        config([
            'services.google_search.credentials' => json_encode(['client_email' => self::EMAIL, 'private_key' => $pem]),
            'services.google_search.property' => 'sc-domain:mydomainbook.test',
        ]);
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'fresh-token', 'expires_in' => 3600]),
            '*' => Http::response([]),
        ]);

        $this->assertTrue(SeoTracker::submit(SeoPage::where('businessId', $business->id)->first()));

        Http::assertSent(function (HttpRequest $r) {
            if (! str_contains($r->url(), 'oauth2.googleapis.com/token')) {
                return false;
            }
            [, $claims] = explode('.', $r['assertion']);
            $claims = json_decode(base64_decode(strtr($claims, '-_', '+/')), true);

            return $r['grant_type'] === 'urn:ietf:params:oauth:grant-type:jwt-bearer' && $claims['iss'] === self::EMAIL
                && str_contains($claims['scope'], 'auth/indexing');
        });
        Http::assertSent(fn (HttpRequest $r) => str_contains($r->url(), 'urlNotifications') && $r->hasHeader('Authorization', 'Bearer fresh-token'));
    }
}
