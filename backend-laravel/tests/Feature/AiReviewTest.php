<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Category;
use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// AI Google Review: the public page drafts a review for a customer to copy
// and post on the business's Google page; the business sets what it mentions.
class AiReviewTest extends TestCase
{
    use RefreshDatabase;

    private Business $business;

    private array $auth;

    private string $ownerEmail;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.ai.provider' => 'builtin']);
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);
        $owner = User::create([
            'email' => 'owner-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'O', 'lastName' => 'W', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER',
        ]);
        $this->business = Business::create([
            'ownerId' => $owner->id, 'name' => 'Spice Garden', 'slug' => 'spice-garden', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '98765 43210', 'addressLine1' => '1 Main St', 'city' => 'Kochi', 'state' => 'KL', 'postalCode' => '682001', 'latitude' => 9.9, 'longitude' => 76.2,
            'googlePlaceId' => 'ChIJ_test_place',
        ]);
        Service::create(['businessId' => $this->business->id, 'name' => 'Kerala Meals', 'priceCents' => 15000]);
        $this->ownerEmail = $owner->email;
        $token = $this->postJson('/api/v1/auth/login', ['email' => $owner->email, 'password' => 'Password123!'])->json('data.accessToken');
        $this->auth = ['Authorization' => "Bearer {$token}"];
    }

    public function test_the_public_page_writes_a_review_to_post_on_google(): void
    {
        $this->get('/review/spice-garden')->assertOk()
            ->assertSee('Spice Garden')->assertSee('Copy &amp; post on Google', false)
            ->assertSee('search.google.com\/local\/writereview?placeid=ChIJ_test_place', false);
        $this->assertSame(1, $this->business->fresh()->aiReviewViews);

        foreach ([5, 4, 3, 1] as $rating) {
            $review = $this->postJson('/api/v1/ai-review/spice-garden/generate', ['rating' => $rating, 'language' => 'en'])
                ->assertOk()->assertJsonPath('data.source', 'builtin')->json('data.review');
            $this->assertGreaterThan(40, mb_strlen($review));
        }
        $this->postJson('/api/v1/ai-review/spice-garden/generate', ['rating' => 6, 'language' => 'en'])->assertStatus(400);
        // Only the languages the business offers.
        $this->postJson('/api/v1/ai-review/spice-garden/generate', ['rating' => 5, 'language' => 'ml'])->assertStatus(400);

        $this->postJson('/api/v1/ai-review/spice-garden/copied')->assertOk();
        $this->assertSame(1, $this->business->fresh()->aiReviewCopies);
    }

    public function test_the_page_is_up_only_with_a_google_link_the_feature_and_a_live_listing(): void
    {
        $this->business->update(['googlePlaceId' => null]);
        $this->get('/review/spice-garden')->assertNotFound();
        $this->postJson('/api/v1/ai-review/spice-garden/generate', ['rating' => 5, 'language' => 'en'])->assertNotFound();

        $this->business->update(['googleReviewUrl' => 'https://g.page/r/spice/review']);
        $this->get('/review/spice-garden')->assertOk()->assertSee('g.page\/r\/spice\/review', false);

        $this->business->update(['features' => ['WEBSITE']]);
        $this->get('/review/spice-garden')->assertNotFound();
        $this->getJson("/api/v1/businesses/{$this->business->id}/ai-review", $this->auth)->assertStatus(403);

        $this->business->update(['features' => null, 'status' => 'DRAFT']);
        $this->get('/review/spice-garden')->assertNotFound();
    }

    public function test_the_business_chooses_what_reviews_mention_and_the_languages(): void
    {
        $url = "/api/v1/businesses/{$this->business->id}/ai-review";
        $this->getJson($url, $this->auth)->assertOk()
            ->assertJsonPath('data.languages', ['en'])->assertJsonPath('data.live', true)
            ->assertJsonPath('data.url', rtrim(config('app.url'), '/').'/review/spice-garden');

        $this->putJson($url, ['highlights' => 'friendly staff', 'languages' => ['en', 'ml']], $this->auth)
            ->assertOk()->assertJsonPath('data.highlights', 'friendly staff')->assertJsonPath('data.languages', ['en', 'ml']);
        $this->putJson($url, ['languages' => ['xx']], $this->auth)->assertStatus(400);
        $this->putJson($url, ['languages' => []], $this->auth)->assertStatus(400);
        $this->get('/review/spice-garden')->assertOk()->assertSee('മലയാളം');

        // The built-in writer names one of the points or services.
        $review = $this->postJson("{$url}/sample", ['rating' => 5, 'language' => 'en'], $this->auth)->assertOk()->json('data.review');
        $this->assertMatchesRegularExpression('/friendly staff|kerala meals/i', $review);

        // A stranger can't change them.
        $other = User::create([
            'email' => 'x-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'X', 'lastName' => 'Y', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER',
        ]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $other->email, 'password' => 'Password123!'])->json('data.accessToken');
        $this->putJson($url, ['highlights' => 'hacked'], ['Authorization' => "Bearer {$token}"])->assertStatus(403);
    }

    public function test_gemini_writes_the_review_in_the_chosen_language(): void
    {
        config(['services.ai.provider' => 'gemini', 'services.gemini.key' => 'test-key']);
        $this->business->update(['aiReview' => ['languages' => ['en', 'ml']]]);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::sequence()
            ->push(['candidates' => [['content' => ['parts' => [['text' => json_encode(['review' => 'നല്ല ഭക്ഷണം, നല്ല സേവനം.'])]]]]]])
            ->push('quota', 429)]);

        $this->postJson('/api/v1/ai-review/spice-garden/generate', ['rating' => 5, 'language' => 'ml'])
            ->assertOk()->assertJsonPath('data.source', 'gemini')->assertJsonPath('data.review', 'നല്ല ഭക്ഷണം, നല്ല സേവനം.');
        Http::assertSent(fn ($request) => str_contains(json_encode($request->data(), JSON_UNESCAPED_UNICODE), 'Language: Malayalam')
            && str_contains(json_encode($request->data()), 'Star rating: 5 out of 5'));

        // When Gemini fails, the built-in writer still gives the customer a review.
        $this->postJson('/api/v1/ai-review/spice-garden/generate', ['rating' => 5, 'language' => 'en'])
            ->assertOk()->assertJsonPath('data.source', 'builtin');
    }

    public function test_the_dashboard_has_the_ai_google_review_section(): void
    {
        $this->withoutVite();
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $this->get("/dashboard/businesses/{$this->business->id}")->assertOk()->assertSee('AI Google Review');
        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('AI Google Review'))->assertOk()
            ->assertSee('Your AI review page')->assertSee('/review/spice-garden')->assertSee('data-ai-settings', false)
            ->assertDontSee('Add your <b>Google review link</b>', false);
    }

    public function test_the_business_controls_tone_length_keywords_staff_and_words_to_avoid(): void
    {
        $url = "/api/v1/businesses/{$this->business->id}/ai-review";
        $this->putJson($url, [
            'tone' => 'professional', 'length' => 'short', 'keywords' => 'kerala food in kochi',
            'staff' => 'Priya', 'avoid' => 'cheap, waiting', 'emoji' => true,
        ], $this->auth)->assertOk()
            ->assertJsonPath('data.tone', 'professional')->assertJsonPath('data.length', 'short')
            ->assertJsonPath('data.keywords', 'kerala food in kochi')->assertJsonPath('data.staff', 'Priya')
            ->assertJsonPath('data.avoid', 'cheap, waiting')->assertJsonPath('data.emoji', true)
            ->assertJsonCount(5, 'data.toneOptions')->assertJsonCount(3, 'data.lengthOptions');
        $this->putJson($url, ['tone' => 'angry'], $this->auth)->assertStatus(400);
        $this->putJson($url, ['length' => 'huge'], $this->auth)->assertStatus(400);

        // The AI is told all of it, plus how recent reviews began.
        config(['services.ai.provider' => 'gemini', 'services.gemini.key' => 'test-key']);
        \App\Models\AiReviewDraft::create(['businessId' => $this->business->id, 'text' => 'Lovely lunch with the family here, the staff were kind.', 'fingerprint' => 'x']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode(['review' => 'Professional service and a warm welcome from Priya. Good kerala food in kochi.'])]]]]]])]);
        $this->postJson('/api/v1/ai-review/spice-garden/generate', ['rating' => 5, 'language' => 'en'])->assertOk()->assertJsonPath('data.unique', true);
        Http::assertSent(function ($request) {
            $brief = json_encode($request->data());

            return str_contains($brief, 'Search phrase to work in once: kerala food in kochi')
                && str_contains($brief, 'Words and phrases never to use: cheap, waiting')
                && str_contains($brief, 'Length: 15 to 35 words')
                && str_contains($brief, 'Emoji: allowed')
                && str_contains($brief, 'Recent reviews started like this; start differently: Lovely lunch with the family')
                && str_contains($brief, 'and professional');
        });
    }

    public function test_a_draft_that_repeats_a_recent_review_or_uses_an_avoided_word_is_written_again(): void
    {
        config(['services.ai.provider' => 'gemini', 'services.gemini.key' => 'test-key']);
        $this->business->update(['aiReview' => ['avoid' => 'cheap']]);
        $old = 'Great food and very friendly staff, I will definitely come back again soon.';
        \App\Models\AiReviewDraft::create(['businessId' => $this->business->id, 'text' => $old, 'fingerprint' => 'x']);
        $reply = fn ($text) => ['candidates' => [['content' => ['parts' => [['text' => json_encode(['review' => $text])]]]]]];
        Http::fake(['generativelanguage.googleapis.com/*' => Http::sequence()
            ->push($reply($old))                                            // a repeat
            ->push($reply('Tasty meals and cheap prices, loved it.'))      // uses an avoided word
            ->push($reply('The Kerala meals were fresh and the welcome was warm. A relaxed lunch we enjoyed.'))]);

        $this->postJson('/api/v1/ai-review/spice-garden/generate', ['rating' => 5, 'language' => 'en'])->assertOk()
            ->assertJsonPath('data.review', 'The Kerala meals were fresh and the welcome was warm. A relaxed lunch we enjoyed.')
            ->assertJsonPath('data.unique', true);
        Http::assertSentCount(3);
        // The one given out is remembered; a try-out from the dashboard isn't.
        $this->assertSame(2, \App\Models\AiReviewDraft::where('businessId', $this->business->id)->count());
        config(['services.ai.provider' => 'builtin']);
        $this->postJson("/api/v1/businesses/{$this->business->id}/ai-review/sample", ['rating' => 5, 'language' => 'en'], $this->auth)->assertOk();
        $this->assertSame(2, \App\Models\AiReviewDraft::where('businessId', $this->business->id)->count());
    }

    public function test_the_built_in_writer_gives_varied_reviews_that_follow_the_settings(): void
    {
        $this->business->update(['aiReview' => ['keywords' => 'kerala meals in kochi', 'staff' => 'Priya', 'avoid' => 'recommended']]);
        $reviews = [];
        for ($i = 0; $i < 30; $i++) {
            $reviews[] = $this->postJson('/api/v1/ai-review/spice-garden/generate', ['rating' => 5, 'language' => 'en'])->assertOk()->json('data.review');
        }
        // No exact repeats, and every one written avoids the banned word where it could.
        $this->assertCount(30, array_unique($reviews));
        $this->assertLessThanOrEqual(3, count(array_filter($reviews, fn ($r) => stripos($r, 'recommended') !== false)));
        $this->assertGreaterThan(0, count(array_filter($reviews, fn ($r) => str_contains($r, 'kerala meals in kochi'))));
        $this->assertGreaterThan(0, count(array_filter($reviews, fn ($r) => str_contains($r, 'Priya'))));
        $this->assertGreaterThan(0.0, \App\Support\AiReview::similarity('a b c d', 'a b c e'));
        $this->assertSame(1.0, \App\Support\AiReview::similarity('Same text here.', 'same TEXT here!'));
    }
}
