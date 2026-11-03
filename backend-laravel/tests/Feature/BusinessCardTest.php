<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\BusinessCard;
use App\Models\Category;
use App\Models\CardTemplate;
use App\Models\User;
use Tests\Support\StarterTemplates;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

// Digital visiting cards: designs per category, kept apart from the
// business's details, switched freely, published at /card/<slug>.
class BusinessCardTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role): User
    {
        return User::create([
            'email' => strtolower($role).'-'.uniqid().'@example.com',
            'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'Test', 'lastName' => 'User', 'status' => 'ACTIVE', 'role' => $role,
        ]);
    }

    private function auth(User $user): array
    {
        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!'])->json('data.accessToken');

        return ['Authorization' => "Bearer {$token}"];
    }

    private function category(string $name, string $slug): Category
    {
        return Category::create(['name' => $name, 'slug' => $slug]);
    }

    private function business(User $owner, Category $category, array $overrides = []): Business
    {
        return Business::create([
            'ownerId' => $owner->id, 'name' => 'Spice Garden', 'slug' => 'spice-garden-'.uniqid(), 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '98765 43210', 'email' => 'hi@spice.test', 'addressLine1' => '1 Main St',
            'city' => 'Kochi', 'state' => 'KL', 'latitude' => 9.9, 'longitude' => 76.2,
            'logoUrl' => 'https://cdn.example.com/logo.png', 'instagramUsername' => 'spicegarden',
            ...$overrides,
        ]);
    }

    public function test_each_main_category_gets_five_starter_designs_and_others_get_the_general_set(): void
    {
        $restaurants = $this->category('Restaurants', 'restaurants');
        $jewellery = $this->category('Jewellery', 'jewellery');
        $this->category('Hospitals', 'hospitals');
        $this->category('Electronics & Appliances', 'electronics-and-appliances');
        $florists = $this->category('Florists', 'florists');

        $this->assertSame(25, StarterTemplates::install());
        $this->assertSame(0, StarterTemplates::install(), 'installing again adds nothing');

        $auth = $this->auth($this->user('BUSINESS_OWNER'));
        $names = $this->getJson("/api/v1/card-templates?categoryId={$restaurants->id}&name=Spice", $auth)
            ->assertOk()->assertJsonCount(5, 'data')->json('data.*.name');
        $this->assertSame(['Premium Restaurant', 'Modern Food Business', 'Traditional Restaurant', 'Luxury Dining', 'Minimal Food Card'], $names);

        $this->getJson("/api/v1/card-templates?categoryId={$jewellery->id}", $auth)
            ->assertJsonPath('data.0.name', 'Luxury Gold')->assertJsonPath('data.0.isDefault', true);
        // A category without its own designs is offered the general ones.
        $general = $this->getJson("/api/v1/card-templates?categoryId={$florists->id}", $auth)->assertJsonCount(5, 'data');
        $this->assertNull($general->json('data.0.categoryId'));
        $this->assertStringContainsString('Your Business Name', $general->json('data.0.previewHtml'));
    }

    public function test_switching_templates_changes_only_the_design_never_the_business_details(): void
    {
        $category = $this->category('Restaurants', 'restaurants');
        StarterTemplates::install();
        $owner = $this->user('BUSINESS_OWNER');
        $business = $this->business($owner, $category);
        $auth = $this->auth($owner);

        $card = $this->getJson("/api/v1/businesses/{$business->id}/card", $auth)->assertOk();
        $card->assertJsonPath('isPublished', null)->assertJsonPath('data.isPublished', false)
            ->assertJsonPath('data.details.name', 'Spice Garden')
            ->assertJsonPath('data.details.whatsappHref', 'https://wa.me/919876543210');
        $default = $card->json('data.templateId');
        $modern = collect($card->json('data.templates'))->firstWhere('name', 'Modern Food Business');
        $this->assertNotSame($default, $modern['id']);
        $this->assertStringContainsString('Spice Garden', $modern['previewHtml']);

        $before = $business->fresh()->only(['name', 'logoUrl', 'phone', 'addressLine1', 'instagramUsername']);
        $this->putJson("/api/v1/businesses/{$business->id}/card", ['templateId' => $modern['id']], $auth)
            ->assertOk()->assertJsonPath('data.templateId', $modern['id']);
        $this->assertSame($before, $business->fresh()->only(array_keys($before)));
        $this->getJson("/api/v1/businesses/{$business->id}/card", $auth)->assertJsonPath('data.templateId', $modern['id']);

        // Edits to the listing show up on the card at once — nothing was copied.
        $business->update(['phone' => '0484 222 333']);
        $this->postJson("/api/v1/businesses/{$business->id}/card/publish", [], $auth)->assertOk()->assertJsonPath('data.live', true);
        $page = $this->get("/card/{$business->slug}")->assertOk();
        $this->assertStringContainsString('0484 222 333', $page->getContent());
        $this->assertStringContainsString('--font-heading:"Poppins"', $page->getContent());
        $this->assertSame(1, BusinessCard::where('businessId', $business->id)->value('viewCount'));
    }

    public function test_every_design_is_open_to_every_business(): void
    {
        $category = $this->category('Restaurants', 'restaurants');
        StarterTemplates::install();
        $owner = $this->user('BUSINESS_OWNER');
        $business = $this->business($owner, $category);
        $auth = $this->auth($owner);
        $this->assertSame(0, CardTemplate::where('isPremium', true)->count());

        // Even one marked premium before premium designs were dropped, on the free plan.
        $luxury = CardTemplate::where('name', 'Luxury Dining')->first();
        $luxury->update(['isPremium' => true]);
        $this->getJson("/api/v1/businesses/{$business->id}/card", $auth)
            ->assertJsonPath('data.templates.3.name', 'Luxury Dining')->assertJsonPath('data.templates.3.locked', false);
        $this->putJson("/api/v1/businesses/{$business->id}/card", ['templateId' => $luxury->id], $auth)->assertOk();
    }

    public function test_the_public_card_and_vcard_appear_only_once_published_and_the_listing_is_live(): void
    {
        $category = $this->category('Restaurants', 'restaurants');
        StarterTemplates::install();
        $owner = $this->user('BUSINESS_OWNER');
        $business = $this->business($owner, $category, ['status' => 'PENDING_APPROVAL']);
        $auth = $this->auth($owner);

        $this->get("/card/{$business->slug}")->assertNotFound();
        $this->postJson("/api/v1/businesses/{$business->id}/card/publish", [], $auth)
            ->assertJsonPath('data.isPublished', true)->assertJsonPath('data.live', false);
        $this->get("/card/{$business->slug}")->assertNotFound();

        $business->update(['status' => 'PUBLISHED']);
        $this->get("/card/{$business->slug}")->assertOk()->assertSee('Spice Garden');
        $vcf = $this->get("/card/{$business->slug}.vcf")->assertOk()->assertHeader('Content-Type', 'text/vcard; charset=UTF-8');
        $this->assertStringContainsString('FN:Spice Garden', $vcf->getContent());

        $this->postJson("/api/v1/businesses/{$business->id}/card/publish", ['isPublished' => false], $auth)->assertOk();
        $this->get("/card/{$business->slug}")->assertNotFound();
    }

    public function test_only_people_who_manage_the_business_can_change_its_card(): void
    {
        $category = $this->category('Restaurants', 'restaurants');
        StarterTemplates::install();
        $business = $this->business($this->user('BUSINESS_OWNER'), $category);
        $stranger = $this->auth($this->user('BUSINESS_OWNER'));

        $this->getJson("/api/v1/businesses/{$business->id}/card", $stranger)->assertStatus(403);
        $this->postJson("/api/v1/businesses/{$business->id}/card/publish", [], $stranger)->assertStatus(403);
    }

    public function test_admin_manages_templates_with_one_default_per_category(): void
    {
        $category = $this->category('Jewellery', 'jewellery');
        StarterTemplates::install();
        $admin = $this->auth($this->user('ADMIN'));
        $this->getJson('/api/v1/admin/card-templates', $this->auth($this->user('BUSINESS_OWNER')))->assertStatus(403);

        $created = $this->postJson('/api/v1/admin/card-templates', [
            'name' => 'Rose Gold', 'categoryId' => $category->id, 'layout' => 'luxury', 'isDefault' => true, 'isPremium' => true,
            'backgroundImageUrl' => 'https://cdn.example.com/rose.jpg',
            'design' => ['colors' => ['primary' => '#B76E79'], 'fonts' => ['heading' => 'Cinzel'], 'buttonStyle' => 'pill'],
        ], $admin)->assertStatus(201)
            ->assertJsonPath('data.design.colors.primary', '#b76e79')
            ->assertJsonPath('data.design.fonts.body', 'Inter')
            ->assertJsonPath('data.isDefault', true);
        $id = $created->json('data.id');
        $this->assertSame(1, CardTemplate::where('categoryId', $category->id)->where('isDefault', true)->count());

        // Unknown fonts, layouts and non-colours are refused.
        $this->postJson('/api/v1/admin/card-templates', ['name' => 'Bad', 'layout' => 'weird'], $admin)->assertStatus(400);
        $this->patchJson("/api/v1/admin/card-templates/{$id}", ['design' => ['fonts' => ['heading' => 'Comic Sans']]], $admin)->assertStatus(400);
        $this->patchJson("/api/v1/admin/card-templates/{$id}", ['design' => ['colors' => ['text' => 'red;}</style>']]], $admin)->assertStatus(400);
        $this->patchJson("/api/v1/admin/card-templates/{$id}", ['backgroundImageUrl' => "https://x.test/a');}"], $admin)->assertStatus(400);

        // A partial design edit keeps the rest.
        $this->patchJson("/api/v1/admin/card-templates/{$id}", ['design' => ['colors' => ['accent' => '#111111']], 'isActive' => false], $admin)
            ->assertOk()->assertJsonPath('data.design.colors.primary', '#b76e79')->assertJsonPath('data.design.colors.accent', '#111111');
        // Inactive designs aren't offered.
        $offered = $this->getJson("/api/v1/card-templates?categoryId={$category->id}", $admin)->json('data.*.id');
        $this->assertNotContains($id, $offered);

        $this->postJson('/api/v1/admin/card-templates/preview', ['layout' => 'split', 'name' => 'Preview Co', 'design' => ['colors' => ['primary' => '#123456']]], $admin)
            ->assertOk()->assertSee('Preview Co')->assertSee('--primary:#123456', false);

        $copy = $this->postJson("/api/v1/admin/card-templates/{$id}/duplicate", [], $admin)->assertStatus(201)
            ->assertJsonPath('data.name', 'Rose Gold (copy)')->assertJsonPath('data.isDefault', false);
        $this->deleteJson("/api/v1/admin/card-templates/{$copy->json('data.id')}", [], $admin)->assertNoContent();
        $this->getJson("/api/v1/admin/card-templates?categoryId={$category->id}", $admin)->assertJsonCount(6, 'data');
        $this->getJson('/api/v1/admin/card-templates?categoryId=general', $admin)->assertJsonCount(5, 'data');
    }

    public function test_a_deleted_or_deactivated_design_falls_back_to_the_category_default(): void
    {
        $category = $this->category('Restaurants', 'restaurants');
        StarterTemplates::install();
        $owner = $this->user('BUSINESS_OWNER');
        $business = $this->business($owner, $category);
        $auth = $this->auth($owner);
        $minimal = CardTemplate::where('name', 'Modern Food Business')->first();
        $this->putJson("/api/v1/businesses/{$business->id}/card", ['templateId' => $minimal->id], $auth)->assertOk();

        $minimal->delete();
        $this->getJson("/api/v1/businesses/{$business->id}/card", $auth)
            ->assertJsonPath('data.templateId', CardTemplate::where('name', 'Premium Restaurant')->value('id'));
    }

    private function signIn(User $user): void
    {
        $this->post('/login', ['email' => $user->email, 'password' => 'Password123!']);
    }

    public function test_the_dashboard_section_and_admin_pages_render(): void
    {
        $this->withoutVite();
        $category = $this->category('Restaurants', 'restaurants');
        StarterTemplates::install();
        $owner = $this->user('BUSINESS_OWNER');
        $business = $this->business($owner, $category);

        $this->signIn($owner);
        $this->get("/dashboard/businesses/{$business->id}?section=".urlencode('Visiting Card'))
            // The owner sees the card and its link, but not the design editor.
            ->assertOk()->assertSee('Your card')->assertSee('Publish card')->assertSee("/card/{$business->slug}")
            ->assertDontSee('Card design & actions', false)->assertDontSee('Drag onto')->assertDontSee('data-hotspot-editor', false);
        $this->get('/dashboard/businesses/new')->assertOk()->assertSee('data-card-picker', false);
        $this->get('/admin?tab='.urlencode('Card Templates'))->assertRedirect();

        $admin = $this->user('ADMIN');
        $this->post('/logout');
        $this->signIn($admin);
        // Admins (and dealers) get the editor.
        $this->get("/dashboard/businesses/{$business->id}?section=".urlencode('Visiting Card'))
            ->assertOk()->assertSee('Card design & actions', false)->assertSee('Drop the card image here')
            // A business's card image isn't swapped from here, and actions are added by clicking the image.
            ->assertDontSee('Replace image')->assertDontSee('Remove image')->assertDontSee('Drag onto')->assertDontSee('data-palette', false);
        $this->get('/admin?tab='.urlencode('Card Templates'))->assertOk()->assertSee('Visiting card templates')->assertSee('Luxury Dining');
        $this->get('/admin/card-templates/new')->assertOk()->assertSee('New card template');
        $template = CardTemplate::where('name', 'Luxury Dining')->first();
        $this->get("/admin/card-templates/{$template->id}")->assertOk()->assertSee('Luxury Dining')->assertSee('Cormorant Garamond');
        $this->get('/admin/card-templates/'.\Illuminate\Support\Str::uuid())->assertNotFound();
    }
}
