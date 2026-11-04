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
        return $this->user(['role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'], 'points' => $points, 'phone' => '9'.random_int(100000000, 999999999)]);
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

    /** Admin: WEBSITE 3 points for 12 months, renewing for 4, at Rs 1,500; GOLD_RATE 2 points unlimited. */
    private function setPrices(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $plans = collect(BusinessFeatures::ALL)->map(fn ($f) => ['feature' => $f, 'points' => 1, 'renewalPoints' => 1, 'price' => null, 'months' => null])->keyBy('feature');
        $plans['WEBSITE'] = ['feature' => 'WEBSITE', 'points' => 3, 'renewalPoints' => 4, 'price' => 1500, 'commission' => 300,
            'renewalPrice' => 1000, 'renewalCommission' => 200, 'months' => 12];
        $plans['GOLD_RATE'] = ['feature' => 'GOLD_RATE', 'points' => 2, 'renewalPoints' => 2, 'price' => 800, 'commission' => 100, 'months' => null];
        $this->putJson('/api/v1/admin/feature-plans', ['plans' => $plans->values()->all()], $this->auth($admin))->assertOk()
            ->assertJsonPath('data.plans.0.feature', 'WEBSITE')->assertJsonPath('data.plans.0.points', 3)
            ->assertJsonPath('data.plans.0.renewalPoints', 4)->assertJsonPath('data.plans.0.price', 1500)
            ->assertJsonPath('data.plans.0.priceLabel', '₹1,500')->assertJsonPath('data.plans.0.commission', 300)
            ->assertJsonPath('data.plans.0.renewalPrice', 1000)->assertJsonPath('data.plans.0.renewalCommission', 200)
            ->assertJsonPath('data.plans.0.duration', '1 year');
    }

    public function test_only_admins_set_prices_and_only_allowed_durations(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $this->getJson('/api/v1/admin/feature-plans', $this->auth($this->dealer()))->assertForbidden();
        $this->putJson('/api/v1/admin/feature-plans', ['plans' => [['feature' => 'WEBSITE', 'points' => 2, 'renewalPoints' => 2, 'price' => null, 'months' => 2]]], $this->auth($admin))->assertStatus(400);
        $this->putJson('/api/v1/admin/feature-plans', ['plans' => [['feature' => 'WEBSITE', 'points' => -1, 'renewalPoints' => 1, 'price' => null, 'months' => null]]], $this->auth($admin))->assertStatus(400);
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
        $dealer = $this->dealer(12);
        $business = $this->business($dealer);
        $this->putJson("/api/v1/businesses/{$business->id}/features", ['features' => ['WEBSITE']], $this->auth($dealer))->assertOk();
        $this->assertTrue(BusinessFeatures::has($business->fresh(), 'WEBSITE'));

        $this->travel(13)->months();
        $business->refresh();
        $this->assertFalse(BusinessFeatures::has($business, 'WEBSITE'));
        $this->assertTrue(BusinessFeatures::expired($business, 'WEBSITE'));
        $this->assertFalse(BusinessFeatures::allowsSection($business, 'Website'));

        // Renewal costs the renewal points, not the first-time points.
        $this->postJson("/api/v1/businesses/{$business->id}/features/WEBSITE/renew", [], $this->auth($dealer))
            ->assertOk()->assertJsonPath('data.spentPoints', 4);
        $this->assertSame(5, $dealer->fresh()->points);
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

    public function test_the_dealer_owes_the_admin_commission_on_sales_and_renewals(): void
    {
        $this->setPrices();
        $admin = $this->user(['role' => 'ADMIN']);
        // A commission over the price is refused.
        $this->putJson('/api/v1/admin/feature-plans', ['plans' => [['feature' => 'WEBSITE', 'points' => 1, 'renewalPoints' => 1, 'price' => 100, 'commission' => 150, 'months' => null]]], $this->auth($admin))
            ->assertStatus(400);

        $dealer = $this->dealer(20);
        $business = $this->business($dealer);
        $this->putJson("/api/v1/businesses/{$business->id}/features", ['features' => ['WEBSITE', 'GOLD_RATE']], $this->auth($dealer))->assertOk();
        $this->assertSame(400, \App\Support\Points::commissionOwed($dealer->id));
        $this->assertSame(1500, PointTransaction::where('feature', 'WEBSITE')->value('priceInr'));

        $this->travel(13)->months();
        $this->postJson("/api/v1/businesses/{$business->id}/features/WEBSITE/renew", [], $this->auth($dealer))->assertOk();
        $this->assertSame(600, \App\Support\Points::commissionOwed($dealer->id));

        // Turning off the unlimited feature takes its commission back off.
        $this->putJson("/api/v1/businesses/{$business->id}/features", ['features' => ['WEBSITE']], $this->auth($dealer))->assertOk();
        $this->assertSame(500, \App\Support\Points::commissionOwed($dealer->id));

        // Later price changes don't change what was owed.
        $this->putJson('/api/v1/admin/feature-plans', ['plans' => [['feature' => 'WEBSITE', 'points' => 1, 'renewalPoints' => 1, 'price' => 5000, 'commission' => 4000, 'renewalPrice' => null, 'renewalCommission' => null, 'months' => 12]]], $this->auth($admin))->assertOk();
        $this->assertSame(500, \App\Support\Points::commissionOwed($dealer->id));
        $this->getJson('/api/v1/points/mine', $this->auth($dealer))->assertOk()->assertJsonPath('data.commissionOwed', 500);

        // The dealer's dashboard shows the total.
        $this->withoutVite();
        $this->post('/login', ['email' => $dealer->email, 'password' => 'Password123!']);
        $this->get('/dashboard')->assertOk()->assertSee('Commission to admin')->assertSee('₹500');
    }

    public function test_dealers_pay_their_pricing_groups_prices(): void
    {
        $this->setPrices();
        $admin = $this->user(['role' => 'ADMIN']);
        $auth = $this->auth($admin);

        // The default group holds today's prices; a new group starts as a copy.
        $index = $this->getJson('/api/v1/admin/feature-plans', $auth)->assertOk()->assertJsonCount(1, 'data.groups')
            ->assertJsonPath('data.group.name', 'Default')->assertJsonPath('data.group.isDefault', true);
        $defaultId = $index->json('data.group.id');
        $goldId = $this->postJson('/api/v1/admin/pricing-groups', ['name' => 'Gold dealers'], $auth)->assertCreated()->json('data.id');
        $this->postJson('/api/v1/admin/pricing-groups', ['name' => 'gold DEALERS'], $auth)->assertStatus(409);
        $this->getJson("/api/v1/admin/feature-plans?groupId={$goldId}", $auth)->assertOk()
            ->assertJsonPath('data.plans.0.points', 3)->assertJsonPath('data.plans.0.months', 12);

        // Cheaper Website for Gold dealers.
        $this->putJson('/api/v1/admin/feature-plans', ['groupId' => $goldId, 'plans' => [
            ['feature' => 'WEBSITE', 'points' => 1, 'renewalPoints' => 1, 'price' => 500, 'commission' => 50, 'months' => 12],
        ]], $auth)->assertOk()->assertJsonPath('data.group.id', $goldId)->assertJsonPath('data.plans.0.points', 1);
        $this->getJson('/api/v1/admin/feature-plans', $auth)->assertJsonPath('data.plans.0.points', 3);

        $gold = $this->dealer(10);
        $plain = $this->dealer(10);
        $this->patchJson("/api/v1/admin/users/{$gold->id}", ['pricingGroupId' => $goldId], $auth)->assertOk()->assertJsonPath('data.pricingGroupId', $goldId);
        $this->patchJson("/api/v1/admin/users/{$gold->id}", ['pricingGroupId' => 'nope'], $auth)->assertStatus(400);

        $this->putJson('/api/v1/businesses/'.$this->business($gold)->id.'/features', ['features' => ['WEBSITE']], $this->auth($gold))->assertOk()->assertJsonPath('data.spentPoints', 1);
        $this->putJson('/api/v1/businesses/'.$this->business($plain)->id.'/features', ['features' => ['WEBSITE']], $this->auth($plain))->assertOk()->assertJsonPath('data.spentPoints', 3);
        $this->assertSame(50, \App\Support\Points::commissionOwed($gold->id));
        $this->assertSame(300, \App\Support\Points::commissionOwed($plain->id));
        $this->getJson('/api/v1/points/mine', $this->auth($gold))->assertJsonPath('data.featurePlans.0.points', 1);

        // Dealer counts: the plain dealer (no group) counts towards the default.
        $groups = collect($this->getJson('/api/v1/admin/feature-plans', $auth)->json('data.groups'))->keyBy('name');
        $this->assertSame(1, $groups['Gold dealers']['dealers']);
        $this->assertSame(1, $groups['Default']['dealers']);

        // The default can't be deleted; another group can be made the default.
        $this->deleteJson("/api/v1/admin/pricing-groups/{$defaultId}", [], $auth)->assertStatus(400);
        $this->patchJson("/api/v1/admin/pricing-groups/{$goldId}", ['isDefault' => true], $auth)->assertOk()->assertJsonPath('data.isDefault', true);
        $this->assertSame(1, \App\Support\FeaturePlans::all()['WEBSITE']['points']);
        $this->assertSame(1, \App\Support\FeaturePlans::forUser($plain->id)['WEBSITE']['points']);

        // Deleting a group moves its dealers to the default.
        $this->patchJson("/api/v1/admin/pricing-groups/{$defaultId}", ['isDefault' => true], $auth)->assertOk();
        $this->deleteJson("/api/v1/admin/pricing-groups/{$goldId}", [], $auth)->assertOk()->assertJsonPath('data.dealersMoved', 1);
        $this->assertNull($gold->fresh()->pricingGroupId);
        $this->assertSame(3, \App\Support\FeaturePlans::forUser($gold->id)['WEBSITE']['points']);

        // The admin pages render.
        $this->withoutVite();
        $this->post('/login', ['email' => $admin->email, 'password' => 'Password123!']);
        $this->get('/admin?tab='.urlencode('Feature Pricing'))->assertOk()->assertSee('Pricing groups')->assertSee('Default');
        $this->get('/admin?tab=Users')->assertOk()->assertSee('admin-pricing-groups', false);
    }

    public function test_the_commission_report_tracks_collected_commission_paid_and_due(): void
    {
        // WEBSITE: Rs 1,500 with Rs 300 commission; GOLD_RATE (unlimited): Rs 800 with Rs 100.
        $this->setPrices();
        $admin = $this->user(['role' => 'ADMIN']);
        $dealer = $this->dealer(20);
        $business = $this->business($dealer);
        $this->putJson("/api/v1/businesses/{$business->id}/features", ['features' => ['WEBSITE', 'GOLD_RATE']], $this->auth($dealer))->assertOk();

        $this->getJson('/api/v1/points/commission', $this->auth($dealer))->assertOk()
            ->assertJsonPath('data.summary.collected', 2300)->assertJsonPath('data.summary.commission', 400)
            ->assertJsonPath('data.summary.paid', 0)->assertJsonPath('data.summary.due', 400)
            ->assertJsonPath('data.summary.earnings', 1900)->assertJsonCount(2, 'data.sales');

        // The admin records Rs 250 received: it comes off what's due.
        $auth = $this->auth($admin);
        $this->postJson("/api/v1/admin/users/{$dealer->id}/commission-payments", ['amount' => 250, 'note' => 'UPI 1234'], $auth)
            ->assertCreated()->assertJsonPath('data.summary.paid', 250)->assertJsonPath('data.summary.due', 150);
        // Not more than is due, and only for dealers.
        $this->postJson("/api/v1/admin/users/{$dealer->id}/commission-payments", ['amount' => 151], $auth)->assertStatus(400);
        $this->postJson("/api/v1/admin/users/{$admin->id}/commission-payments", ['amount' => 1], $auth)->assertStatus(400);
        // Dealers can't record payments.
        $this->postJson("/api/v1/admin/users/{$dealer->id}/commission-payments", ['amount' => 1], $this->auth($dealer))->assertForbidden();

        // Refunding the unlimited feature takes its price and commission off.
        $this->putJson("/api/v1/businesses/{$business->id}/features", ['features' => ['WEBSITE']], $this->auth($dealer))->assertOk();
        $report = $this->getJson("/api/v1/admin/users/{$dealer->id}/commission", $auth)->assertOk()
            ->assertJsonPath('data.summary.collected', 1500)->assertJsonPath('data.summary.commission', 300)
            ->assertJsonPath('data.summary.due', 50)->assertJsonCount(1, 'data.payments');

        // A payment recorded by mistake can be removed: it's owed again.
        $paymentId = $report->json('data.payments.0.id');
        $this->deleteJson("/api/v1/admin/commission-payments/{$paymentId}", [], $auth)->assertOk()->assertJsonPath('data.summary.due', 300);

        // The dealer's Commission tab.
        $this->withoutVite();
        $this->post('/login', ['email' => $dealer->email, 'password' => 'Password123!']);
        $this->get('/dashboard?tab=commission')->assertOk()
            ->assertSee('Due to admin')->assertSee('Sales and renewals')->assertSee('Payments to admin')->assertSee('₹1,500');
        $this->get('/dashboard')->assertOk()->assertSee('₹300 due');
    }

    public function test_the_admin_commission_report_covers_every_dealer(): void
    {
        $this->setPrices();
        $admin = $this->user(['role' => 'ADMIN']);
        $auth = $this->auth($admin);
        $owes = $this->dealer(20);
        $owes->update(['firstName' => 'Anil']);
        $settled = $this->dealer(20);
        $settled->update(['firstName' => 'Bina']);
        $idle = $this->dealer(20);
        $idle->update(['firstName' => 'Chetan']);
        // Website: Rs 300 commission each; Bina pays hers in full.
        $this->putJson('/api/v1/businesses/'.$this->business($owes)->id.'/features', ['features' => ['WEBSITE']], $this->auth($owes))->assertOk();
        $this->putJson('/api/v1/businesses/'.$this->business($settled)->id.'/features', ['features' => ['WEBSITE', 'GOLD_RATE']], $this->auth($settled))->assertOk();
        $this->postJson("/api/v1/admin/users/{$settled->id}/commission-payments", ['amount' => 400], $auth)->assertCreated();

        $report = $this->getJson('/api/v1/admin/commission', $auth)->assertOk()
            ->assertJsonPath('data.totals.collected', 3800)->assertJsonPath('data.totals.commission', 700)
            ->assertJsonPath('data.totals.paid', 400)->assertJsonPath('data.totals.due', 300)
            ->assertJsonPath('data.totals.paidThisMonth', 400)
            ->assertJsonCount(3, 'data.dealers')->assertJsonCount(1, 'data.recentPayments');
        // Most due first.
        $this->assertSame('Anil', $report->json('data.dealers.0.firstName'));
        $this->assertSame(300, $report->json('data.dealers.0.due'));

        $this->getJson('/api/v1/admin/commission?due=1', $auth)->assertJsonCount(1, 'data.dealers')->assertJsonPath('data.dealers.0.firstName', 'Anil');
        $this->getJson('/api/v1/admin/commission?search=Bina', $auth)->assertJsonCount(1, 'data.dealers')->assertJsonPath('data.dealers.0.paid', 400);
        $this->getJson('/api/v1/admin/commission?sort=name', $auth)->assertJsonPath('data.dealers.2.firstName', 'Chetan');
        $this->getJson('/api/v1/admin/commission', $this->auth($owes))->assertForbidden();

        $this->withoutVite();
        $this->post('/login', ['email' => $admin->email, 'password' => 'Password123!']);
        $this->get('/admin?tab=Commission')->assertOk()->assertSee('Due from dealers')->assertSee('Anil')->assertSee('Record payment')->assertSee('Latest payments received');
    }

    public function test_the_commission_charts_bucket_by_day_week_and_month(): void
    {
        $this->travelTo(\Illuminate\Support\Carbon::parse('2026-11-04 10:00'));
        $this->setPrices();
        $admin = $this->user(['role' => 'ADMIN']);
        $dealer = $this->dealer(20);
        // Website (Rs 1,500 / Rs 300) two months ago; Gold rate (Rs 800 / Rs 100) today, and Rs 250 paid today.
        $this->travelTo(\Illuminate\Support\Carbon::parse('2026-09-10 10:00'));
        $this->putJson('/api/v1/businesses/'.$this->business($dealer)->id.'/features', ['features' => ['WEBSITE']], $this->auth($dealer))->assertOk();
        $this->travelTo(\Illuminate\Support\Carbon::parse('2026-11-04 10:00'));
        $this->putJson('/api/v1/businesses/'.$this->business($dealer)->id.'/features', ['features' => ['GOLD_RATE']], $this->auth($dealer))->assertOk();
        $this->postJson("/api/v1/admin/users/{$dealer->id}/commission-payments", ['amount' => 250], $this->auth($admin))->assertCreated();

        $t = \App\Support\Commission::timeline($dealer->id);
        $this->assertCount(30, $t['daily']);
        $this->assertCount(12, $t['weekly']);
        $this->assertCount(12, $t['monthly']);

        $today = end($t['daily']);
        $this->assertSame(['2026-11-04', 800, 100, 250], [$today['key'], $today['collected'], $today['commission'], $today['received']]);
        // September is outside the 30 days.
        $this->assertSame(800, array_sum(array_column($t['daily'], 'collected')));

        $months = collect($t['monthly'])->keyBy('key');
        $this->assertSame('2025-12', $t['monthly'][0]['key']);
        $this->assertSame(1500, $months['2026-09']['collected']);
        $this->assertSame(300, $months['2026-09']['commission']);
        $this->assertSame(250, $months['2026-11']['received']);
        $this->assertSame('November 2026', $months['2026-11']['title']);

        // All dealers together on the admin report; the dealer's own on theirs.
        $this->getJson('/api/v1/admin/commission', $this->auth($admin))->assertOk()->assertJsonCount(12, 'data.timeline.monthly');
        $this->getJson('/api/v1/points/commission', $this->auth($dealer))->assertOk()->assertJsonPath('data.timeline.monthly.11.commission', 100);

        $this->withoutVite();
        $this->post('/login', ['email' => $admin->email, 'password' => 'Password123!']);
        $this->get('/admin?tab=Commission')->assertOk()->assertSee('data-commission-charts', false)->assertSee('Commission over time');
    }
}
