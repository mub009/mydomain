<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SiteBuilderTest extends TestCase
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

    private function business(User $owner, array $overrides = []): Business
    {
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);

        return Business::create([
            'ownerId' => $owner->id, 'name' => "Alice's Diner", 'slug' => 'diner-'.uniqid(), 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '+91 98765 43210', 'addressLine1' => '1 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
            ...$overrides,
        ]);
    }

    public function test_editor_returns_a_starter_page_for_every_template_before_anything_is_saved(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $token = $this->token($owner);

        $response = $this->getJson("/api/v1/businesses/{$business->id}/site", ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(200)
            ->assertJsonPath('data.hasSavedDraft', false)
            ->assertJsonPath('data.templateId', 'classic')
            ->assertJsonPath('data.renderedTemplateId', 'classic')
            ->assertJsonCount(4, 'data.templates');

        $html = $response->json('data.starterHtml');
        $this->assertStringContainsString("Alice&#039;s Diner", $html);
        // ctx.phone (used in tel: links) is the phone as entered, not the
        // digits-only form — matches Node exactly.
        $this->assertStringContainsString('tel:+91 98765 43210', $html);
        $this->assertStringContainsString('https://wa.me/919876543210', $html);
    }

    public function test_editor_can_preview_a_different_template_without_saving(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $token = $this->token($owner);

        $response = $this->getJson("/api/v1/businesses/{$business->id}/site?templateId=vibrant", ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(200)
            ->assertJsonPath('data.templateId', 'classic')
            ->assertJsonPath('data.renderedTemplateId', 'vibrant');
    }

    public function test_preview_template_renders_any_known_design_and_rejects_unknown_ones(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $token = $this->token($owner);

        foreach (['classic', 'modern', 'elegant', 'vibrant'] as $id) {
            $this->getJson("/api/v1/businesses/{$business->id}/site/templates/{$id}", ['Authorization' => "Bearer {$token}"])
                ->assertStatus(200)
                ->assertJsonPath('data.templateId', $id);
        }

        $this->getJson("/api/v1/businesses/{$business->id}/site/templates/nonexistent", ['Authorization' => "Bearer {$token}"])
            ->assertStatus(400);
    }

    public function test_owner_saves_a_draft_and_it_is_sanitized_and_persisted(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $token = $this->token($owner);

        $dirtyHtml = '<h1>Welcome</h1><script>alert(1)</script><button onclick="evil()">Click</button>';
        $dirtyCss = 'body{color:red} .x{behavior:url(#default#time2)}';

        $response = $this->putJson("/api/v1/businesses/{$business->id}/site", [
            'html' => $dirtyHtml, 'css' => $dirtyCss, 'templateId' => 'modern',
            'projectData' => ['blocks' => ['hero']],
        ], ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(200)->assertJsonPath('data.templateId', 'modern');

        $editor = $this->getJson("/api/v1/businesses/{$business->id}/site", ['Authorization' => "Bearer {$token}"]);
        $editor->assertStatus(200)
            ->assertJsonPath('data.hasSavedDraft', true)
            ->assertJsonPath('data.templateId', 'modern')
            ->assertJsonPath('data.projectData.blocks.0', 'hero');

        $this->assertDatabaseHas('business_sites', ['businessId' => $business->id]);
        $site = \App\Models\BusinessSite::where('businessId', $business->id)->first();
        $this->assertStringNotContainsString('<script', $site->html);
        $this->assertStringNotContainsString('onclick', $site->html);
        $this->assertStringContainsString('<h1>Welcome</h1>', $site->html);
        $this->assertStringNotContainsString('behavior', $site->css);
    }

    public function test_saving_rejects_an_unknown_template(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $token = $this->token($owner);

        $this->putJson("/api/v1/businesses/{$business->id}/site", ['templateId' => 'nope'], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(400);
    }

    public function test_publishing_a_website_requires_saved_html_first(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $token = $this->token($owner);

        $this->postJson("/api/v1/businesses/{$business->id}/site/publish", ['isPublished' => true], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(400);

        $this->putJson("/api/v1/businesses/{$business->id}/site", ['html' => '<h1>Hi</h1>'], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200);

        $publish = $this->postJson("/api/v1/businesses/{$business->id}/site/publish", ['isPublished' => true], ['Authorization' => "Bearer {$token}"]);
        $publish->assertStatus(200)
            ->assertJsonPath('data.isPublished', true)
            ->assertJsonPath('data.url', "/site/{$business->slug}");

        $public = $this->getJson("/api/v1/sites/{$business->slug}");
        $public->assertStatus(200)->assertJsonPath('data.html', '<h1>Hi</h1>');
    }

    public function test_only_the_owner_can_edit_or_save_the_site(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $other = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $token = $this->token($other);

        $this->getJson("/api/v1/businesses/{$business->id}/site", ['Authorization' => "Bearer {$token}"])->assertStatus(403);
        $this->putJson("/api/v1/businesses/{$business->id}/site", ['html' => '<h1>x</h1>'], ['Authorization' => "Bearer {$token}"])->assertStatus(403);
    }
}
