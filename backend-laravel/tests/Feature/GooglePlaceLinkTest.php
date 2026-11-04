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
}
