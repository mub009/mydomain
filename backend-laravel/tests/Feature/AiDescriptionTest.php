<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// POST /ai/business-description: who may ask, what it needs, and which
// writer answers — Gemini (faked here), or the free built-in writer when
// there is no key or Gemini can't help.
class AiDescriptionTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/ai/business-description';

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.ai.provider' => null, 'services.gemini.key' => null, 'services.anthropic.key' => null]);
        Http::preventStrayRequests();
    }

    private function auth(string $role = 'DEALER'): array
    {
        $user = User::create([
            'email' => strtolower($role).uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'T', 'lastName' => 'U', 'status' => 'ACTIVE', 'role' => $role,
            'privileges' => $role === 'DEALER' ? ['MANAGE_LISTINGS'] : null,
        ]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!'])->json('data.accessToken');

        return ['Authorization' => "Bearer {$token}"];
    }

    private function brief(): array
    {
        $category = Category::firstOrCreate(['slug' => 'restaurants'], ['name' => 'Restaurants']);

        return ['name' => 'Green Leaf Cafe', 'categoryId' => $category->id, 'city' => 'Kochi', 'businessType' => 'B2C'];
    }

    public function test_only_signed_in_owners_dealers_and_admins_can_ask(): void
    {
        $this->postJson(self::URL, ['name' => 'Cafe', 'category' => 'Cafe'])->assertUnauthorized();
        $this->postJson(self::URL, ['name' => 'Cafe', 'category' => 'Cafe'], $this->auth('CUSTOMER'))->assertForbidden();
    }

    public function test_it_needs_a_name_and_a_category(): void
    {
        $auth = $this->auth();

        $this->postJson(self::URL, ['category' => 'Cafe'], $auth)->assertStatus(400);
        $this->postJson(self::URL, ['name' => 'Green Leaf'], $auth)->assertStatus(400)->assertJsonPath('error.message', 'Choose a category first');
        $this->postJson(self::URL, ['name' => 'Green Leaf', 'categoryId' => '00000000-0000-0000-0000-000000000000'], $auth)->assertStatus(400);
        $this->postJson(self::URL, ['name' => 'Green Leaf', 'category' => 'Cafe', 'businessType' => 'XYZ'], $auth)->assertStatus(400);
    }

    public function test_with_no_key_the_free_built_in_writer_answers(): void
    {
        $response = $this->postJson(self::URL, $this->brief(), $this->auth())->assertOk()->assertJsonPath('data.source', 'builtin');

        $text = $response->json('data.description');
        $this->assertStringContainsString('Green Leaf Cafe', $text);
        $this->assertStringContainsString('Kochi', $text);
        $this->assertDoesNotMatchRegularExpression('/\d{6,}|₹|rs\.?\s?\d/i', $text, 'no invented numbers or prices');
        Http::assertNothingSent();

        // The form always offers the button.
        $this->assertStringContainsString('data-ai-write', (string) $this->blade('<x-ai-description />'));
    }

    public function test_with_a_gemini_key_gemini_writes_it(): void
    {
        config(['services.gemini.key' => 'g-test-key', 'services.gemini.model' => 'gemini-3.5-flash-lite']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => json_encode(['description' => 'A cosy cafe in Kochi.'])]]], 'finishReason' => 'STOP']],
        ])]);

        $this->postJson(self::URL, $this->brief(), $this->auth())->assertOk()
            ->assertJsonPath('data.source', 'gemini')
            ->assertJsonPath('data.description', 'A cosy cafe in Kochi.');

        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/models/gemini-3.5-flash-lite:generateContent')
            && $request->header('x-goog-api-key') === ['g-test-key']
            && $request['generationConfig']['responseMimeType'] === 'application/json'
            && str_contains($request['contents'][0]['parts'][0]['text'], 'Business name: Green Leaf Cafe'));
    }

    public function test_when_gemini_cannot_help_the_built_in_writer_steps_in(): void
    {
        config(['services.gemini.key' => 'g-test-key']);
        $auth = $this->auth();

        // The free tier's quota is used up.
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['error' => ['code' => 429, 'status' => 'RESOURCE_EXHAUSTED']], 429)]);
        $this->postJson(self::URL, $this->brief(), $auth)->assertOk()->assertJsonPath('data.source', 'builtin');

        // The prompt was blocked, or nothing usable came back.
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['promptFeedback' => ['blockReason' => 'OTHER']])]);
        $this->postJson(self::URL, $this->brief(), $auth)->assertOk()->assertJsonPath('data.source', 'builtin');
    }

    public function test_the_provider_can_be_forced(): void
    {
        config(['services.gemini.key' => 'g-test-key', 'services.ai.provider' => 'builtin']);

        $this->postJson(self::URL, $this->brief(), $this->auth())->assertOk()->assertJsonPath('data.source', 'builtin');
        Http::assertNothingSent();
    }
}
