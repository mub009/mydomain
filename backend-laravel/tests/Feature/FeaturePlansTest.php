<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Category;
use App\Models\PointTransaction;
use App\Models\User;
use App\Support\BusinessFeatures;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

// Feature pricing: the admin sets each feature's cost in points and how long
// it lasts; a timed feature switches off on its end date until the dealer
// renews it for the same points, and is never refunded.
class FeaturePlansTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $overrides = []): User
    {
        return User::create([
            'email' => 'user'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'Test', 'lastName' => 'User', 'status' => 'ACTIVE', ...$overrides,
        ]);
    }

    private function auth(User $user): array
    {
        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!'])->json('data.accessToken');

        return ['Authorization' => "Bearer {$token}"];
    }

    private function dealer(int $points = 20): User
    {
        return $this->user(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => $points]);
    }

    private function business(User $dealer, array $features = []): Business
    {
        $category = Category::firstOrCreate(['slug' => 'restaurants'], ['name' => 'Restaurants']);

        return Business::create([
            'ownerId' => $dealer->id, 'createdById' => $dealer->id, 'name' => 'Spice Route', 'slug' => 'spice-'.uniqid(),
            'categoryId' => $category->id, 'status' => 'PUBLISHED', 'phone' => '+91 98765 43210',
            'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8, 'features' => $features,
        ]);
    }

    /** Admin: WEBSITE 3 points for 12 months, GOLD_RATE 2 points unlimited. */
    private function setPrices(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $plans = collect(BusinessFeatures::ALL)->map(fn ($f) => ['feature' => $f, 'points' => 1, 'months' => null])->keyBy('feature');
        $plans['WEBSITE'] = ['feature' => 'WEBSITE', 'points' => 3, 'months' => 12];
        $plans['GOLD_RATE'] = ['feature' => 'GOLD_RATE', 'points' => 2, 'months' => null];
        $this->putJson('/api/v1/admin/feature-plans', ['plans' => $plans->values()->all()], $this->auth($admin))->assertOk()
            ->assertJsonPath('data.plans.0.feature', 'WEBSITE')->assertJsonPath('data.plans.0.points', 3)->assertJsonPath('data.plans.0.duration', '1 year');
    }

    public function test_only_admins_set_prices_and_only_allowed_durations(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $this->getJson('/api/v1/admin/feature-plans', $this->auth($this->dealer()))->assertForbidden();
        $this->putJson('/api/v1/admin/feature-plans', ['plans' => [['feature' => 'WEBSITE', 'points' => 2, 'months' => 2]]], $this->auth($admin))->assertStatus(400);
        $this->putJson('/api/v1/admin/feature-plans', ['plans' => [['feature' => 'WEBSITE', 'points' => -1, 'months' => null]]], $this->auth($admin))->assertStatus(400);
        $this->getJson('/api/v1/admin/feature-plans', $this->auth($admin))->assertOk()->assertJsonCount(5, 'data.plans')->assertJsonCount(5, 'data.durations');
    }

    public function test_a_timed_feature_costs_its_price_runs_a_year_and_cannot_be_switched_off_early(): void
    {
        $this->setPrices();
        $dealer = $this->dealer(20);
        $business = $this->business($dealer);

        $this->putJson("/api/v1/businesses/{$business->id}/features", ['features' => ['WEBSITE', 'GOLD_RATE']], $this->auth($dealer))
            ->assertOk()->assertJsonPath('data.spentPoints', 5);
        $this->assertSame(15, $dealer->fresh()->points);
        $business->refresh();
        $this->assertTrue(BusinessFeatures::expiry($business, 'WEBSITE')->between(now()->addMonths(12)->subMinute(), now()->addMonths(12)->addMinute()));
        $this->assertNull(BusinessFeatures::expiry($business, 'GOLD_RATE'));
        $this->assertSame(12, PointTransaction::where('feature', 'WEBSITE')->value('durationMonths'));

        // Paid up: the dealer can't take it off early (it isn't refunded).
        $this->putJson("/api/v1/businesses/{$business->id}/features", ['features' => ['GOLD_RATE']], $this->auth($dealer))->assertStatus(400);

        // The unlimited one still gives its points back.
        $this->putJson("/api/v1/businesses/{$business->id}/features", ['features' => ['WEBSITE']], $this->auth($dealer))
            ->assertOk()->assertJsonPath('data.refundedPoints', 2);
        $this->assertSame(17, $dealer->fresh()->points);
    }

    public function test_an_expired_feature_switches_off_until_renewed(): void
    {
        $this->setPrices();
        $dealer = $this->dealer(10);
        $business = $this->business($dealer);
        $this->putJson("/api/v1/businesses/{$business->id}/features", ['features' => ['WEBSITE']], $this->auth($dealer))->assertOk();
        $this->assertTrue(BusinessFeatures::has($business->fresh(), 'WEBSITE'));

        $this->travel(13)->months();
        $business->refresh();
        $this->assertFalse(BusinessFeatures::has($business, 'WEBSITE'));
        $this->assertTrue(BusinessFeatures::expired($business, 'WEBSITE'));
        $this->assertFalse(BusinessFeatures::allowsSection($business, 'Website'));

        $this->postJson("/api/v1/businesses/{$business->id}/features/WEBSITE/renew", [], $this->auth($dealer))
            ->assertOk()->assertJsonPath('data.spentPoints', 3);
        $this->assertSame(4, $dealer->fresh()->points);
        $business->refresh();
        $this->assertTrue(BusinessFeatures::has($business, 'WEBSITE'));
        // A lapsed feature's new year starts today.
        $this->assertTrue(BusinessFeatures::expiry($business, 'WEBSITE')->between(now()->addMonths(12)->subMinute(), now()->addMonths(12)->addMinute()));
        $this->assertSame(1, PointTransaction::where('type', 'FEATURE_RENEWED')->count());

        // Renewing early adds a year onto the end date.
        $this->postJson("/api/v1/businesses/{$business->id}/features/WEBSITE/renew", [], $this->auth($dealer))->assertOk();
        $this->assertTrue(BusinessFeatures::expiry($business->fresh(), 'WEBSITE')->between(now()->addMonths(24)->subMinute(), now()->addMonths(24)->addMinute()));

        // Out of points: no renewal.
        $this->postJson("/api/v1/businesses/{$business->id}/features/WEBSITE/renew", [], $this->auth($dealer))->assertForbidden();
        // An unlimited feature has nothing to renew.
        $this->putJson("/api/v1/businesses/{$business->id}/features", ['features' => ['WEBSITE', 'AI_REVIEW']], $this->auth($dealer))->assertOk();
        $this->postJson("/api/v1/businesses/{$business->id}/features/AI_REVIEW/renew", [], $this->auth($dealer))->assertStatus(400);
    }

    public function test_timed_purchases_are_not_refunded_when_removed_or_the_business_is_deleted(): void
    {
        $this->setPrices();
        $dealer = $this->dealer(10);
        $business = $this->business($dealer);
        $this->putJson("/api/v1/businesses/{$business->id}/features", ['features' => ['WEBSITE', 'GOLD_RATE']], $this->auth($dealer))->assertOk();
        $this->assertSame(5, $dealer->fresh()->points);

        // Once expired it can be taken off, with nothing back.
        $this->travel(13)->months();
        $this->putJson("/api/v1/businesses/{$business->id}/features", ['features' => ['GOLD_RATE']], $this->auth($dealer))
            ->assertOk()->assertJsonPath('data.refundedPoints', 0);
        $this->assertNull($business->fresh()->featureExpiry);

        // Deleting the listing returns only the unlimited feature's points.
        $this->deleteJson("/api/v1/businesses/{$business->id}", [], $this->auth($dealer))->assertOk();
        $this->assertSame(7, $dealer->fresh()->points);
    }

    public function test_features_a_business_already_has_stay_unlimited(): void
    {
        $dealer = $this->dealer();
        $business = $this->business($dealer, ['WEBSITE']);
        $this->setPrices();

        $this->travel(5)->years();
        $this->assertTrue(BusinessFeatures::has($business->fresh(), 'WEBSITE'));
    }

    public function test_the_admin_adds_features_free_and_unlimited_and_the_dealer_sees_prices(): void
    {
        $this->setPrices();
        $admin = $this->user(['role' => 'ADMIN']);
        $dealer = $this->dealer(10);
        $business = $this->business($dealer);
        $this->putJson("/api/v1/businesses/{$business->id}/features", ['features' => ['WEBSITE']], $this->auth($admin))
            ->assertOk()->assertJsonPath('data.spentPoints', 0);
        $this->assertNull(BusinessFeatures::expiry($business->fresh(), 'WEBSITE'));
        $this->assertSame(10, $dealer->fresh()->points);

        $this->getJson('/api/v1/points/mine', $this->auth($dealer))->assertOk()
            ->assertJsonPath('data.featurePlans.0.points', 3)->assertJsonPath('data.featurePlans.0.duration', '1 year');
    }
}
