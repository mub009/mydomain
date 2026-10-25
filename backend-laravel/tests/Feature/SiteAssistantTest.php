<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\BusinessHours;
use App\Models\BusinessSite;
use App\Models\Category;
use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// The website assistant: Gemini (faked here) proposes changes from what the
// owner said; they are applied only on confirmation, all or nothing.
class SiteAssistantTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Business $business;

    private array $auth;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.gemini.key' => 'g-test', 'services.gemini.base_url' => 'https://gemini.test']);
        Http::preventStrayRequests();

        $this->owner = User::create([
            'email' => 'owner@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'O', 'lastName' => 'W', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER',
        ]);
        $this->business = Business::create([
            'ownerId' => $this->owner->id, 'name' => 'Spice Route', 'slug' => 'spice-route', 'status' => 'PUBLISHED',
            'categoryId' => Category::create(['name' => 'Restaurants', 'slug' => 'restaurants'])->id,
            'phone' => '+91 98765 43210', 'addressLine1' => '1 Main St', 'city' => 'Pune', 'state' => 'MH',
            'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ]);
        foreach (range(0, 6) as $day) {
            BusinessHours::create(['businessId' => $this->business->id, 'dayOfWeek' => $day, 'openTime' => '10:00', 'closeTime' => '20:00', 'isClosed' => false]);
        }
        Service::create(['businessId' => $this->business->id, 'name' => 'Masala Dosa', 'priceCents' => 12000, 'isActive' => true]);
        Service::create(['businessId' => $this->business->id, 'name' => 'Filter Coffee', 'priceCents' => 4000, 'isActive' => true]);

        $token = $this->postJson('/api/v1/auth/login', ['email' => 'owner@example.com', 'password' => 'Password123!'])->json('data.accessToken');
        $this->auth = ['Authorization' => "Bearer {$token}"];
    }

    private function geminiSays(array $answer): void
    {
        Http::fake(['gemini.test/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => json_encode($answer)]]], 'finishReason' => 'STOP']],
        ])]);
    }

    private function url(string $suffix = ''): string
    {
        return "/api/v1/businesses/{$this->business->id}/assistant{$suffix}";
    }

    public function test_it_plans_changes_with_summaries_and_explains_what_it_cannot_do(): void
    {
        $this->geminiSays([
            'reply' => "I'll make those changes.",
            'actions' => [
                ['type' => 'update_details', 'details' => ['phone' => '98470 12345', 'city' => 'Pune']], // city unchanged → dropped
                // A day's times split across entries, as the model sometimes does.
                ['type' => 'set_hours', 'hours' => [['day' => 'sunday', 'closed' => true, 'open' => '', 'close' => ''], ['day' => 'saturday', 'open' => '9am'], ['day' => 'saturday', 'close' => '10:30 pm']]],
                ['type' => 'add_service', 'service' => ['name' => 'Chicken Biryani', 'priceRupees' => 250]],
                ['type' => 'update_service', 'service' => ['name' => 'masala dosa', 'priceRupees' => 140]],
                ['type' => 'remove_service', 'service' => ['name' => 'Ghee Roast']],
                ['type' => 'set_template', 'templateId' => 'modern'],
            ],
        ]);

        $plan = $this->postJson($this->url(), ['message' => 'lots of changes'], $this->auth)->assertOk()->json('data');

        $this->assertSame("I'll make those changes.", $plan['reply']);
        $this->assertSame([
            'Phone: 98470 12345',
            'Hours — Sunday: closed · Saturday: 09:00–22:30',
            'Add service: Chicken Biryani — ₹250',
            'Service “Masala Dosa”: price ₹120 → ₹140',
            'Website design → Modern Dark (the page is rebuilt from your details; builder edits are replaced)',
        ], array_column($plan['actions'], 'summary'));
        $this->assertSame(['I couldn\'t find a service called “Ghee Roast”.'], $plan['notes']);

        // The model is given the business as it is now, and the owner's words.
        Http::assertSent(fn ($request) => str_contains($request['contents'][0]['parts'][0]['text'], '"Masala Dosa"')
            && str_contains($request['contents'][0]['parts'][0]['text'], 'lots of changes'));
        // Nothing has changed yet.
        $this->assertSame('+91 98765 43210', $this->business->fresh()->phone);
    }

    public function test_applying_makes_exactly_the_planned_changes(): void
    {
        $this->geminiSays(['reply' => 'ok', 'actions' => [
            ['type' => 'update_details', 'details' => ['phone' => '98470 12345']],
            ['type' => 'set_hours', 'hours' => [['day' => 'sunday', 'closed' => true, 'open' => '', 'close' => '']]],
            ['type' => 'add_service', 'service' => ['name' => 'Chicken Biryani', 'priceRupees' => 250]],
            ['type' => 'update_service', 'service' => ['name' => 'Masala Dosa', 'priceRupees' => 140]],
            ['type' => 'remove_service', 'service' => ['name' => 'Filter Coffee']],
            ['type' => 'set_template', 'templateId' => 'modern'],
        ]]);
        $actions = $this->postJson($this->url(), ['message' => 'go'], $this->auth)->json('data.actions');

        $this->postJson($this->url('/apply'), ['actions' => $actions], $this->auth)->assertOk()->assertJsonCount(6, 'data.applied');

        $business = $this->business->fresh(['hours', 'services']);
        $this->assertSame('98470 12345', $business->phone);
        // Only Sunday changed; the rest of the week kept its hours.
        $this->assertTrue((bool) $business->hours->firstWhere('dayOfWeek', 0)->isClosed);
        $this->assertSame('10:00', substr($business->hours->firstWhere('dayOfWeek', 3)->openTime, 0, 5));
        $this->assertCount(7, $business->hours);
        $this->assertEqualsCanonicalizing(['Masala Dosa', 'Chicken Biryani'], $business->services->pluck('name')->all());
        $this->assertSame(14000, (int) $business->services->firstWhere('name', 'Masala Dosa')->priceCents);
        $site = BusinessSite::where('businessId', $business->id)->first();
        $this->assertSame('modern', $site->templateId);
        $this->assertStringContainsString('98470 12345', $site->html);
    }

    public function test_a_change_that_fails_validation_applies_nothing(): void
    {
        $this->postJson($this->url('/apply'), ['actions' => [
            ['type' => 'add_service', 'service' => ['name' => 'Tea', 'priceRupees' => 20]],
            ['type' => 'update_details', 'details' => ['email' => 'not-an-email']],
        ]], $this->auth)->assertStatus(400);

        $this->assertNull(Service::where('name', 'Tea')->first());
    }

    public function test_it_needs_gemini_and_only_works_for_people_who_manage_the_business(): void
    {
        $stranger = User::create(['email' => 's@example.com', 'passwordHash' => Hash::make('Password123!'), 'firstName' => 'S', 'lastName' => 'S', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER']);
        $token = $this->postJson('/api/v1/auth/login', ['email' => 's@example.com', 'password' => 'Password123!'])->json('data.accessToken');
        $this->postJson($this->url(), ['message' => 'change phone to 9000011111'], ['Authorization' => "Bearer {$token}"])->assertForbidden();
        $this->postJson($this->url('/apply'), ['actions' => [['type' => 'update_details', 'details' => ['phone' => '9000011111']]]], ['Authorization' => "Bearer {$token}"])->assertForbidden();

        config(['services.gemini.key' => null]);
        $this->postJson($this->url(), ['message' => 'hello'], $this->auth)->assertStatus(503)->assertJsonPath('error.code', 'ASSISTANT_NOT_CONFIGURED');
    }

    public function test_the_free_quota_running_out_is_explained(): void
    {
        Http::fake(['gemini.test/*' => Http::response(['error' => ['code' => 429]], 429)]);

        $this->postJson($this->url(), ['message' => 'change phone to 9000011111'], $this->auth)
            ->assertStatus(429)->assertJsonPath('error.code', 'ASSISTANT_BUSY');
    }

    public function test_a_service_can_only_be_changed_through_its_own_business(): void
    {
        $other = Business::create([
            'ownerId' => User::create(['email' => 'x@example.com', 'passwordHash' => 'x', 'firstName' => 'X', 'lastName' => 'X', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER'])->id,
            'name' => 'Other', 'slug' => 'other', 'status' => 'PUBLISHED', 'categoryId' => $this->business->categoryId,
            'phone' => '9000000000', 'addressLine1' => 'x', 'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ]);
        $theirs = Service::create(['businessId' => $other->id, 'name' => 'Theirs', 'priceCents' => 100, 'isActive' => true]);

        // The owner's own business in the URL, someone else's service id.
        $this->patchJson("/api/v1/businesses/{$this->business->id}/services/{$theirs->id}", ['name' => 'Hijacked'], $this->auth)->assertNotFound();
        $this->deleteJson("/api/v1/businesses/{$this->business->id}/services/{$theirs->id}", [], $this->auth);
        $this->assertSame('Theirs', $theirs->fresh()?->name);
    }
}
