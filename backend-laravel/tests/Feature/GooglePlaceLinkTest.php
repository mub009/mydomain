<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Category;
use App\Models\User;
use App\Support\GooglePlaceLink;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// An owner pastes Google Maps' "Share" link; we find the Place ID in it,
// so customers are sent straight to Google's review box.
class GooglePlaceLinkTest extends TestCase
{
    use RefreshDatabase;

    // Where a real maps.app.goo.gl link redirects, and that place's Place ID.
    private const MAPS_URL = 'https://www.google.com/maps/place/Dr.+Khalid+Alruhaimi+Medical+Complex/@26.3763896,49.9443251,14z/data=!4m7!3m6!1s0x3e3603f7579191d5:0x11432635c36f95b2!8m2!3d26.3720449!4d49.9700743?entry=tts';

    private const PLACE_ID = 'ChIJ1ZGRV_cDNj4RspVvwzUmQxE';

    public function test_a_maps_feature_id_becomes_its_place_id(): void
    {
        $this->assertSame(self::PLACE_ID, GooglePlaceLink::fromFeatureId('3e3603f7579191d5', '11432635c36f95b2'));
        $this->assertSame(self::PLACE_ID, GooglePlaceLink::fromText(self::MAPS_URL));
        $this->assertSame(self::PLACE_ID, GooglePlaceLink::fromText('https://search.google.com/local/writereview?placeid='.self::PLACE_ID));
        $this->assertNull(GooglePlaceLink::fromText('https://example.com/nothing'));
        $this->assertTrue(GooglePlaceLink::isDirectReviewLink('https://g.page/r/CfAbC123/review'));
        $this->assertFalse(GooglePlaceLink::isDirectReviewLink('https://maps.app.goo.gl/JuRuei5Z2NrM7pcW6'));
    }

    public function test_a_pasted_share_link_fills_in_the_place_id(): void
    {
        Http::fake([
            'maps.app.goo.gl/*' => Http::response('', 302, ['Location' => self::MAPS_URL]),
            'share.google/*' => Http::response('', 302, ['Location' => 'https://www.google.com/share.google?q=abc']),
            'www.google.com/share.google*' => Http::response('<html>no place here</html>', 200),
            'evil.example/*' => Http::response('', 302, ['Location' => self::MAPS_URL]),
        ]);
        $owner = User::create([
            'email' => 'o-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'O', 'lastName' => 'W', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER',
        ]);
        $business = Business::create([
            'ownerId' => $owner->id, 'name' => 'Clinic', 'slug' => 'clinic', 'categoryId' => Category::create(['name' => 'Clinics', 'slug' => 'clinics'])->id,
            'status' => 'PUBLISHED', 'addressLine1' => '1 Main St', 'city' => 'Dammam', 'state' => 'EP', 'postalCode' => '32241', 'latitude' => 26.37, 'longitude' => 49.97,
        ]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $owner->email, 'password' => 'Password123!'])->json('data.accessToken');
        $auth = ['Authorization' => "Bearer {$token}"];
        $url = "/api/v1/businesses/{$business->id}/review-links";

        // The share link in the review link box: the Place ID is filled in, and customers get Google's review box.
        $this->patchJson($url, ['googleReviewUrl' => 'https://maps.app.goo.gl/JuRuei5Z2NrM7pcW6'], $auth)->assertOk()
            ->assertJsonPath('data.googlePlaceId', self::PLACE_ID)->assertJsonPath('data.googleReviewUrl', null)
            ->assertJsonPath('data.resolved.GOOGLE', 'https://search.google.com/local/writereview?placeid='.self::PLACE_ID);

        // Pasted into the Place ID box works too; a link with no place in it is refused there.
        Business::whereKey($business->id)->update(['googlePlaceId' => null]);
        $this->patchJson($url, ['googlePlaceId' => 'https://maps.app.goo.gl/JuRuei5Z2NrM7pcW6'], $auth)->assertOk()->assertJsonPath('data.googlePlaceId', self::PLACE_ID);
        $this->patchJson($url, ['googlePlaceId' => 'https://share.google/abc'], $auth)->assertStatus(400);

        // A link we can't read is kept: it still opens the business on Google.
        Business::whereKey($business->id)->update(['googlePlaceId' => null]);
        $this->patchJson($url, ['googleReviewUrl' => 'https://share.google/abc'], $auth)->assertOk()
            ->assertJsonPath('data.googleReviewUrl', 'https://share.google/abc')->assertJsonPath('data.googlePlaceId', null);

        // Only Google's own hosts are fetched.
        $this->patchJson($url, ['googlePlaceId' => 'https://evil.example/x'], $auth)->assertStatus(400);
        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'evil.example'));
    }

    public function test_find_my_business_on_google_searches_places(): void
    {
        $owner = User::create([
            'email' => 'o-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'O', 'lastName' => 'W', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER',
        ]);
        $business = Business::create([
            'ownerId' => $owner->id, 'name' => 'Alruhaimi Clinic', 'slug' => 'clinic', 'categoryId' => Category::create(['name' => 'Clinics', 'slug' => 'clinics'])->id,
            'status' => 'PUBLISHED', 'addressLine1' => '1 Main St', 'city' => 'Dammam', 'state' => 'EP', 'postalCode' => '32241', 'latitude' => 26.37, 'longitude' => 49.97,
        ]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $owner->email, 'password' => 'Password123!'])->json('data.accessToken');
        $auth = ['Authorization' => "Bearer {$token}"];
        $url = "/api/v1/businesses/{$business->id}/review-links";

        // No key: the button isn't offered, and the search says to paste a link instead.
        config(['services.google_places.key' => null]);
        $this->getJson($url, $auth)->assertOk()->assertJsonPath('data.placesSearch', false);
        $this->getJson("{$url}/google-places", $auth)->assertStatus(400);

        config(['services.google_places.key' => 'places-key']);
        Http::fake(['places.googleapis.com/*' => Http::sequence()
            ->push(['places' => [
                ['id' => self::PLACE_ID, 'displayName' => ['text' => 'Dr. Khalid Alruhaimi Medical Complex'], 'formattedAddress' => 'Dammam, Saudi Arabia'],
            ]])
            // Then Google refusing (bad key, billing off).
            ->push(['error' => ['message' => 'API key not valid']], 403)]);
        $this->getJson($url, $auth)->assertJsonPath('data.placesSearch', true);
        // With no query typed, it searches the listing's name and city, near the shop.
        $this->getJson("{$url}/google-places", $auth)->assertOk()
            ->assertJsonPath('data.query', 'Alruhaimi Clinic Dammam')
            ->assertJsonPath('data.places.0.id', self::PLACE_ID)
            ->assertJsonPath('data.places.0.name', 'Dr. Khalid Alruhaimi Medical Complex');
        Http::assertSent(fn ($request) => $request->hasHeader('X-Goog-Api-Key', 'places-key')
            && $request->hasHeader('X-Goog-FieldMask', 'places.id,places.displayName,places.formattedAddress')
            && $request['textQuery'] === 'Alruhaimi Clinic Dammam'
            && $request['locationBias']['circle']['center']['latitude'] === 26.37);

        // Google refusing (bad key, billing off) is a plain message, not an error page.
        $this->getJson("{$url}/google-places?q=x", $auth)->assertStatus(400)->assertJsonFragment(['message' => 'Google search is not working right now. Paste your Google Maps share link instead.']);
    }

    public function test_an_admin_is_told_why_google_refuses_the_search(): void
    {
        $admin = User::create([
            'email' => 'a-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'A', 'lastName' => 'D', 'status' => 'ACTIVE', 'role' => 'ADMIN',
        ]);
        $business = Business::create([
            'ownerId' => $admin->id, 'name' => 'Clinic', 'slug' => 'clinic-a', 'categoryId' => Category::create(['name' => 'Clinics', 'slug' => 'clinics'])->id,
            'status' => 'PUBLISHED', 'addressLine1' => '1 Main St', 'city' => 'Dammam', 'state' => 'EP', 'latitude' => 26.37, 'longitude' => 49.97,
        ]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => 'Password123!'])->json('data.accessToken');
        $url = "/api/v1/businesses/{$business->id}/review-links/google-places";
        config(['services.google_places.key' => 'places-key']);
        $refusal = fn (string $reason, string $message) => ['error' => ['code' => 403, 'message' => $message, 'status' => 'PERMISSION_DENIED', 'details' => [['@type' => 'type.googleapis.com/google.rpc.ErrorInfo', 'reason' => $reason]]]];
        Http::fake(['places.googleapis.com/*' => Http::sequence()
            ->push($refusal('SERVICE_DISABLED', 'Places API (New) has not been used in project 123 before or it is disabled.'), 403)
            ->push($refusal('API_KEY_HTTP_REFERRER_BLOCKED', 'Requests from referer <empty> are blocked.'), 403)
            ->push($refusal('BILLING_DISABLED', 'This API method requires billing to be enabled.'), 403)
            ->push($refusal('API_KEY_SERVICE_BLOCKED', 'Requests to this API places.googleapis.com method are blocked.'), 403)]);

        $why = fn () => $this->getJson($url, ['Authorization' => "Bearer {$token}"])->assertStatus(400)->json('error.message');
        $this->assertStringContainsString('Enable "Places API (New)"', $why());
        $this->assertStringContainsString('"Application restrictions" to None', $why());
        $this->assertStringContainsString('Billing is not turned on', $why());
        $this->assertStringContainsString('add Places API (New)', $why());
    }

    public function test_places_check_says_whether_the_key_works(): void
    {
        config(['services.google_places.key' => null]);
        $this->artisan('places:check')->expectsOutputToContain('GOOGLE_PLACES_API_KEY is empty')->assertFailed();

        config(['services.google_places.key' => 'places-key']);
        Http::fake(['places.googleapis.com/*' => Http::sequence()
            ->push(['error' => ['message' => 'API key not valid. Please pass a valid API key.', 'details' => [['reason' => 'API_KEY_INVALID']]]], 400)
            ->push(['places' => [['id' => self::PLACE_ID, 'displayName' => ['text' => 'Markkito Cafe'], 'formattedAddress' => 'Kochi']]])]);
        $this->artisan('places:check')->expectsOutputToContain('The key is not valid')->assertFailed();
        $this->artisan('places:check')->expectsOutputToContain('The key works: 1 place(s) found.')->assertSuccessful();
    }
}
