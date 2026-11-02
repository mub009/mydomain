<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\BusinessCard;
use App\Models\Category;
use App\Models\CardTemplate;
use App\Models\User;
use App\Support\Cards\StarterTemplates;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

// AI-made visiting-card backgrounds (App\Support\Cards\BackgroundGenerator).
class CardBackgroundTest extends TestCase
{
    use RefreshDatabase;

    private Business $business;

    private array $auth;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('spaces', ['url' => 'https://cdn.example.test']);
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);
        StarterTemplates::install();
        $owner = User::create([
            'email' => 'owner-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'O', 'lastName' => 'W', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER',
        ]);
        $this->business = Business::create([
            'ownerId' => $owner->id, 'name' => 'Spice Garden', 'slug' => 'spice-garden', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '9876543210', 'addressLine1' => '1 Main St', 'city' => 'Kochi', 'state' => 'KL',
            'latitude' => 9.9, 'longitude' => 76.2, 'description' => 'Kerala meals and seafood.',
        ]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $owner->email, 'password' => 'Password123!'])->json('data.accessToken');
        $this->auth = ['Authorization' => "Bearer {$token}"];
    }

    private function pngBase64(): string
    {
        $img = imagecreatetruecolor(32, 18);
        ob_start();
        imagepng($img);

        return base64_encode(ob_get_clean());
    }

    private function storedFiles(): array
    {
        return Storage::disk('spaces')->allFiles('cards/ai-backgrounds');
    }

    public function test_without_an_ai_key_the_built_in_generator_makes_a_background(): void
    {
        config(['services.gemini.key' => null]);
        Http::fake();

        $res = $this->postJson("/api/v1/businesses/{$this->business->id}/card/background", ['hint' => 'banana leaves'], $this->auth)
            ->assertOk()->assertJsonPath('data.source', 'builtin');
        Http::assertNothingSent();
        $this->assertCount(1, $this->storedFiles());
        $this->assertStringContainsString($res->json('data.url'), $res->json('data.previewHtml'));
        // Generating doesn't apply it.
        $this->assertNull(BusinessCard::where('businessId', $this->business->id)->value('backgroundImageUrl'));
    }

    public function test_gemini_paints_it_from_the_business_details_without_any_text(): void
    {
        config(['services.gemini.key' => 'test-key', 'services.ai.provider' => null]);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['inlineData' => ['mimeType' => 'image/png', 'data' => $this->pngBase64()]]]]]],
        ])]);

        $this->postJson("/api/v1/businesses/{$this->business->id}/card/background", ['hint' => 'banana leaves'], $this->auth)
            ->assertOk()->assertJsonPath('data.source', 'gemini');

        Http::assertSent(function (HttpRequest $request) {
            $prompt = $request['contents'][0]['parts'][0]['text'];

            return str_contains($request->url(), 'gemini-2.5-flash-image:generateContent')
                && $request['generationConfig']['responseModalities'] === ['IMAGE']
                && str_contains($prompt, 'Restaurants') && str_contains($prompt, 'Kochi')
                && str_contains($prompt, 'Spice Garden') && str_contains($prompt, 'Kerala meals')
                && str_contains($prompt, 'banana leaves') && str_contains($prompt, 'no text');
        });
        $this->assertCount(1, $this->storedFiles());
    }

    public function test_a_failing_ai_service_falls_back_to_the_built_in_generator(): void
    {
        config(['services.gemini.key' => 'test-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['error' => ['code' => 429]], 429)]);

        $this->postJson("/api/v1/businesses/{$this->business->id}/card/background", [], $this->auth)
            ->assertOk()->assertJsonPath('data.source', 'builtin');
        $this->assertCount(1, $this->storedFiles());
    }

    public function test_a_kept_background_stays_through_template_switches_and_can_be_removed(): void
    {
        config(['services.gemini.key' => null]);
        $url = $this->postJson("/api/v1/businesses/{$this->business->id}/card/background", [], $this->auth)->json('data.url');

        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['backgroundImageUrl' => $url], $this->auth)
            ->assertOk()->assertJsonPath('data.backgroundImageUrl', $url);
        $other = CardTemplate::where('name', 'Modern Food Business')->first();
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['templateId' => $other->id], $this->auth)->assertOk();

        $card = $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)
            ->assertJsonPath('data.backgroundImageUrl', $url)->assertJsonPath('data.templateId', $other->id);
        foreach ($card->json('data.templates') as $t) {
            $this->assertStringContainsString($url, $t['previewHtml']);
        }
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth);
        $this->assertStringContainsString($url, $this->get('/card/spice-garden')->getContent());

        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['backgroundImageUrl' => "https://x.test/a');}"], $this->auth)->assertStatus(400);
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['backgroundImageUrl' => null], $this->auth)
            ->assertOk()->assertJsonPath('data.backgroundImageUrl', null);
        $this->assertStringNotContainsString($url, $this->get('/card/spice-garden')->getContent());
    }

    public function test_admins_generate_template_backgrounds_and_others_cannot(): void
    {
        config(['services.gemini.key' => null]);
        $this->postJson('/api/v1/admin/card-templates/background', ['layout' => 'luxury'], $this->auth)->assertStatus(403);

        $admin = User::create([
            'email' => 'admin-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'A', 'lastName' => 'D', 'status' => 'ACTIVE', 'role' => 'ADMIN',
        ]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => 'Password123!'])->json('data.accessToken');
        $res = $this->postJson('/api/v1/admin/card-templates/background', [
            'layout' => 'luxury', 'categoryId' => Category::first()->id, 'design' => ['colors' => ['primary' => '#111111', 'accent' => '#d4af37']],
        ], ['Authorization' => "Bearer {$token}"])->assertOk()->assertJsonPath('data.source', 'builtin');
        $this->assertNotEmpty($res->json('data.url'));
        $this->assertCount(1, Storage::disk('spaces')->allFiles('cards/backgrounds'));
    }

    public function test_owners_pick_a_poster_style_and_the_prompt_follows_it(): void
    {
        config(['services.gemini.key' => 'test-key', 'services.ai.provider' => null]);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['inlineData' => ['mimeType' => 'image/png', 'data' => $this->pngBase64()]]]]]],
        ])]);

        $this->postJson("/api/v1/businesses/{$this->business->id}/card/background", ['style' => 'festive'], $this->auth)
            ->assertOk()->assertJsonPath('data.style', 'festive');
        Http::assertSent(function (HttpRequest $request) {
            $prompt = $request['contents'][0]['parts'][0]['text'];

            // The festive look, and a restaurant's own subject matter.
            return str_contains($prompt, 'poster-style') && str_contains($prompt, 'diyas')
                && str_contains($prompt, 'plated signature dishes') && str_contains($prompt, 'negative space');
        });

        $this->postJson("/api/v1/businesses/{$this->business->id}/card/background", ['style' => 'cartoon'], $this->auth)->assertStatus(400);
        $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)
            ->assertJsonPath('data.aiStyles.luxury', 'Luxury')->assertJsonPath('data.aiDefaultStyle', 'photo');
    }

    public function test_every_offline_style_paints_its_own_picture(): void
    {
        $colors = ['primary' => '#7c2d12', 'accent' => '#f59e0b'];
        $images = [];
        foreach (\App\Support\Cards\PosterArt::STYLES as $style) {
            $png = \App\Support\Cards\PosterArt::render($style, $colors, 'Spice Garden', false);
            $this->assertSame([1280, 720], array_slice(getimagesizefromstring($png), 0, 2), $style);
            $images[$style] = md5($png);
        }
        $this->assertCount(count($images), array_unique($images));
        // Same business, same picture; another business, another one.
        $this->assertSame($images['poster'], md5(\App\Support\Cards\PosterArt::render('poster', $colors, 'Spice Garden', false)));
        $this->assertNotSame($images['poster'], md5(\App\Support\Cards\PosterArt::render('poster', $colors, 'Other Cafe', false)));
        $this->assertSame([900, 1200], array_slice(getimagesizefromstring(\App\Support\Cards\PosterArt::render('luxury', $colors, 'x', true)), 0, 2));
    }
}
