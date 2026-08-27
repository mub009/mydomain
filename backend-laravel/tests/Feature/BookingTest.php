<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\BusinessHours;
use App\Models\Category;
use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BookingTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $overrides = []): User
    {
        return User::create([
            'email' => $overrides['email'] ?? 'user'.uniqid().'@example.com',
            'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'Test', 'lastName' => 'User', 'status' => 'ACTIVE',
            ...$overrides,
        ]);
    }

    private function token(User $user): string
    {
        return $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!'])
            ->json('data.accessToken');
    }

    private function businessWithService(User $owner): array
    {
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);
        $business = Business::create([
            'ownerId' => $owner->id, 'name' => 'Shop', 'slug' => 'shop', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '9998887777', 'addressLine1' => '1 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ]);
        $service = Service::create([
            'businessId' => $business->id, 'name' => 'Haircut', 'priceCents' => 50000, 'durationMins' => 30,
        ]);

        return [$business, $service];
    }

    // A fixed future Monday at 11:00 so day-of-week-scoped hours are deterministic.
    private function nextMondayAt(string $time): \Carbon\Carbon
    {
        return \Carbon\Carbon::parse('next monday')->setTimeFromTimeString($time);
    }

    public function test_customer_books_a_service_within_business_hours(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $customer = $this->user(['role' => 'CUSTOMER']);
        [$business, $service] = $this->businessWithService($owner);
        BusinessHours::create(['businessId' => $business->id, 'dayOfWeek' => 1, 'openTime' => '09:00', 'closeTime' => '18:00']);

        $token = $this->token($customer);
        $this->postJson("/api/v1/businesses/{$business->id}/bookings", [
            'serviceId' => $service->id, 'scheduledAt' => $this->nextMondayAt('11:00')->toIso8601String(),
        ], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(201)
            ->assertJsonPath('data.status', 'PENDING')
            ->assertJsonPath('data.priceCents', 50000);
    }

    public function test_booking_outside_business_hours_is_rejected(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $customer = $this->user(['role' => 'CUSTOMER']);
        [$business, $service] = $this->businessWithService($owner);
        BusinessHours::create(['businessId' => $business->id, 'dayOfWeek' => 1, 'openTime' => '09:00', 'closeTime' => '18:00']);

        $token = $this->token($customer);
        $this->postJson("/api/v1/businesses/{$business->id}/bookings", [
            'serviceId' => $service->id, 'scheduledAt' => $this->nextMondayAt('20:00')->toIso8601String(),
        ], ['Authorization' => "Bearer {$token}"])->assertStatus(400);
    }

    public function test_double_booking_the_same_slot_conflicts(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $customerA = $this->user(['role' => 'CUSTOMER']);
        $customerB = $this->user(['role' => 'CUSTOMER']);
        [$business, $service] = $this->businessWithService($owner);
        BusinessHours::create(['businessId' => $business->id, 'dayOfWeek' => 1, 'openTime' => '09:00', 'closeTime' => '18:00']);
        $slot = $this->nextMondayAt('11:00')->toIso8601String();

        $this->postJson("/api/v1/businesses/{$business->id}/bookings", ['serviceId' => $service->id, 'scheduledAt' => $slot], ['Authorization' => 'Bearer '.$this->token($customerA)])
            ->assertStatus(201);

        $this->postJson("/api/v1/businesses/{$business->id}/bookings", ['serviceId' => $service->id, 'scheduledAt' => $slot], ['Authorization' => 'Bearer '.$this->token($customerB)])
            ->assertStatus(409);
    }

    public function test_customer_can_cancel_but_not_confirm_their_own_booking(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $customer = $this->user(['role' => 'CUSTOMER']);
        [$business, $service] = $this->businessWithService($owner);
        BusinessHours::create(['businessId' => $business->id, 'dayOfWeek' => 1, 'openTime' => '09:00', 'closeTime' => '18:00']);

        $customerToken = $this->token($customer);
        $booking = $this->postJson("/api/v1/businesses/{$business->id}/bookings", [
            'serviceId' => $service->id, 'scheduledAt' => $this->nextMondayAt('11:00')->toIso8601String(),
        ], ['Authorization' => "Bearer {$customerToken}"])->json('data');

        $this->patchJson("/api/v1/bookings/{$booking['id']}/status", ['status' => 'CONFIRMED'], ['Authorization' => "Bearer {$customerToken}"])
            ->assertStatus(403);

        $this->patchJson("/api/v1/bookings/{$booking['id']}/status", ['status' => 'CANCELLED'], ['Authorization' => "Bearer {$customerToken}"])
            ->assertStatus(200)->assertJsonPath('data.status', 'CANCELLED');
    }

    public function test_owner_confirms_and_lists_business_bookings(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $customer = $this->user(['role' => 'CUSTOMER']);
        [$business, $service] = $this->businessWithService($owner);
        BusinessHours::create(['businessId' => $business->id, 'dayOfWeek' => 1, 'openTime' => '09:00', 'closeTime' => '18:00']);

        $booking = $this->postJson("/api/v1/businesses/{$business->id}/bookings", [
            'serviceId' => $service->id, 'scheduledAt' => $this->nextMondayAt('11:00')->toIso8601String(),
        ], ['Authorization' => 'Bearer '.$this->token($customer)])->json('data');

        $ownerToken = $this->token($owner);
        $this->patchJson("/api/v1/bookings/{$booking['id']}/status", ['status' => 'CONFIRMED'], ['Authorization' => "Bearer {$ownerToken}"])
            ->assertStatus(200)->assertJsonPath('data.status', 'CONFIRMED');

        $this->getJson("/api/v1/businesses/{$business->id}/bookings", ['Authorization' => "Bearer {$ownerToken}"])
            ->assertStatus(200)->assertJsonPath('meta.total', 1);
    }

    public function test_my_bookings_lists_the_customers_own_bookings(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $customer = $this->user(['role' => 'CUSTOMER']);
        [$business, $service] = $this->businessWithService($owner);
        BusinessHours::create(['businessId' => $business->id, 'dayOfWeek' => 1, 'openTime' => '09:00', 'closeTime' => '18:00']);

        $token = $this->token($customer);
        $this->postJson("/api/v1/businesses/{$business->id}/bookings", [
            'serviceId' => $service->id, 'scheduledAt' => $this->nextMondayAt('11:00')->toIso8601String(),
        ], ['Authorization' => "Bearer {$token}"]);

        $this->getJson('/api/v1/bookings/mine', ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)->assertJsonPath('meta.total', 1);
    }
}
