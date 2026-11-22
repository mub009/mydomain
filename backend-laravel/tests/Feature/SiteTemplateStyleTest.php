<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

// An admin's CSS overrides for a website template (App\Models\SiteTemplateStyle),
// applied on top of every business using that template.
class SiteTemplateStyleTest extends TestCase
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

    private function business(User $owner): Business
    {
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);

        return Business::create([
            'ownerId' => $owner->id, 'name' => "Alice's Diner", 'slug' => 'diner-'.uniqid(), 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '+91 98765 43210', 'addressLine1' => '1 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ]);
    }

    public function test_only_an_admin_can_read_or_save_a_templates_style(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $auth = ['Authorization' => "Bearer {$this->token($owner)}"];

        $this->getJson('/api/v1/admin/site-templates/standard', $auth)->assertStatus(403);
        $this->putJson('/api/v1/admin/site-templates/standard', ['customCss' => 'h2{color:red}'], $auth)->assertStatus(403);
        $this->postJson('/api/v1/admin/site-templates/standard/preview', ['customCss' => ''], $auth)->assertStatus(403);
    }

    public function test_an_admin_saves_css_and_it_shows_up_for_every_business_on_that_template(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $auth = ['Authorization' => "Bearer {$this->token($admin)}"];

        $this->getJson('/api/v1/admin/site-templates/standard', $auth)->assertOk()->assertJsonPath('data.customCss', '');

        $this->putJson('/api/v1/admin/site-templates/standard', ['customCss' => '.about_section{background:#000}'], $auth)
            ->assertOk()->assertJsonPath('data.customCss', '.about_section{background:#000}');

        $this->getJson('/api/v1/admin/site-templates/standard', $auth)
            ->assertOk()->assertJsonPath('data.customCss', '.about_section{background:#000}');

        // Shows up in the business's own starter page, through the normal
        // template-building path, with no change to that business at all.
        $ownerAuth = ['Authorization' => "Bearer {$this->token($owner)}"];
        $html = $this->getJson("/api/v1/businesses/{$business->id}/site/templates/standard", $ownerAuth)->json('data.html');
        $css = $this->getJson("/api/v1/businesses/{$business->id}/site/templates/standard", $ownerAuth)->json('data.css');
        $this->assertStringContainsString('.about_section{background:#000}', $css);
        $this->assertNotEmpty($html);

        // Unknown template id is rejected.
        $this->getJson('/api/v1/admin/site-templates/not-a-template', $auth)->assertStatus(400);
    }

    public function test_preview_shows_the_draft_css_without_saving_it(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $this->business($owner);
        $auth = ['Authorization' => "Bearer {$this->token($admin)}"];

        $resp = $this->postJson('/api/v1/admin/site-templates/standard/preview', ['customCss' => '.about_section{background:#123456}'], $auth)
            ->assertOk();
        $this->assertStringContainsString('.about_section{background:#123456}', $resp->json('data.css'));
        $this->assertStringContainsString('id="about"', $resp->json('data.html'));

        // Nothing was saved.
        $this->getJson('/api/v1/admin/site-templates/standard', $auth)->assertOk()->assertJsonPath('data.customCss', '');
    }

    public function test_preview_fails_gracefully_with_no_businesses_at_all(): void
    {
        $admin = $this->user(['role' => 'ADMIN']);
        $auth = ['Authorization' => "Bearer {$this->token($admin)}"];

        $this->postJson('/api/v1/admin/site-templates/standard/preview', ['customCss' => ''], $auth)->assertStatus(404);
    }
}
