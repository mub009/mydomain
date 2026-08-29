<?php

namespace Tests\Feature;

use App\Models\PageView;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AnalyticsTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'CUSTOMER'): User
    {
        return User::create([
            'email' => strtolower($role).'-'.uniqid().'@example.com',
            'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'Test', 'lastName' => 'User', 'status' => 'ACTIVE', 'role' => $role,
        ]);
    }

    private function token(User $user): string
    {
        return $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!'])
            ->json('data.accessToken');
    }

    // Backdates a page view's createdAt, bypassing Eloquent's automatic
    // timestamp so ordering/window tests can control it directly.
    private function pageView(array $attributes, ?\DateTimeInterface $createdAt = null): PageView
    {
        $view = PageView::create($attributes);
        if ($createdAt) {
            $view->timestamps = false;
            $view->forceFill(['createdAt' => $createdAt])->save();
        }

        return $view->fresh();
    }

    public function test_a_pageview_is_recorded_with_device_and_browser_parsed_from_user_agent(): void
    {
        $response = $this->postJson('/api/v1/analytics/pageview', [
            'visitorId' => 'v-abc123',
            'path' => '/business/spice-route-kitchen',
            'referrer' => 'https://google.com',
        ], ['User-Agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1']);

        $response->assertStatus(204);

        $this->assertDatabaseHas('page_views', [
            'visitorId' => 'v-abc123',
            'path' => '/business/spice-route-kitchen',
            'referrer' => 'https://google.com',
            'device' => 'Mobile',
            'browser' => 'Safari',
            // The test client's IP is loopback, which has no public
            // geolocation, so it is skipped rather than looked up.
            'city' => null,
        ]);
    }

    public function test_pageview_requires_visitorId_and_path(): void
    {
        $this->postJson('/api/v1/analytics/pageview', [])->assertStatus(400);
    }

    public function test_a_logged_in_users_pageview_records_their_user_id(): void
    {
        $user = $this->user();
        $token = $this->token($user);

        $this->postJson('/api/v1/analytics/pageview', [
            'visitorId' => 'v-loggedin',
            'path' => '/dashboard',
        ], ['Authorization' => "Bearer {$token}"])->assertStatus(204);

        $this->assertDatabaseHas('page_views', ['visitorId' => 'v-loggedin', 'userId' => $user->id]);
    }

    public function test_online_endpoint_deduplicates_by_visitor_to_their_latest_page(): void
    {
        $admin = $this->user('ADMIN');
        $token = $this->token($admin);

        // Same visitor, three hits — only the newest should surface.
        $this->pageView(['visitorId' => 'v-1', 'path' => '/', 'ip' => '203.0.113.5'], now()->subMinutes(3));
        $this->pageView(['visitorId' => 'v-1', 'path' => '/search', 'ip' => '203.0.113.5'], now()->subMinutes(2));
        $this->pageView(['visitorId' => 'v-1', 'path' => '/business/spice-route-kitchen', 'ip' => '203.0.113.5'], now()->subMinute());
        // A different visitor, currently online.
        $this->pageView(['visitorId' => 'v-2', 'path' => '/', 'ip' => '203.0.113.9'], now()->subSeconds(30));
        // Outside the online window — must not appear.
        $this->pageView(['visitorId' => 'v-3', 'path' => '/', 'ip' => '203.0.113.10'], now()->subMinutes(20));

        $response = $this->getJson('/api/v1/admin/analytics/online', ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(200)->assertJsonPath('data.count', 2);
        $paths = collect($response->json('data.online'))->pluck('path', 'visitorId');
        $this->assertSame('/business/spice-route-kitchen', $paths['v-1']);
        $this->assertSame('/', $paths['v-2']);
        $this->assertArrayNotHasKey('v-3', $paths);
    }

    public function test_most_visited_pages_are_aggregated_and_ranked(): void
    {
        $admin = $this->user('ADMIN');
        $token = $this->token($admin);

        foreach (['v-1', 'v-2', 'v-3'] as $visitor) {
            $this->pageView(['visitorId' => $visitor, 'path' => '/popular', 'ip' => '203.0.113.5'], now());
        }
        $this->pageView(['visitorId' => 'v-1', 'path' => '/quiet', 'ip' => '203.0.113.5'], now());
        // Outside the default 7-day range — must not be counted.
        $this->pageView(['visitorId' => 'v-4', 'path' => '/popular', 'ip' => '203.0.113.5'], now()->subDays(10));

        $response = $this->getJson('/api/v1/admin/analytics/pages', ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(200);
        $pages = collect($response->json('data.pages'))->keyBy('path');
        $this->assertSame(3, $pages['/popular']['views']);
        $this->assertSame(3, $pages['/popular']['uniqueVisitors']);
        $this->assertSame(1, $pages['/quiet']['views']);
        $this->assertSame(4, $response->json('data.totalViews'));
    }

    public function test_only_an_admin_can_view_analytics(): void
    {
        $customer = $this->user('CUSTOMER');
        $token = $this->token($customer);

        $this->getJson('/api/v1/admin/analytics/online', ['Authorization' => "Bearer {$token}"])->assertStatus(403);
        $this->getJson('/api/v1/admin/analytics/pages', ['Authorization' => "Bearer {$token}"])->assertStatus(403);
    }
}
