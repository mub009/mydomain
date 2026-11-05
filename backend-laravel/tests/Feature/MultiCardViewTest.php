<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\BusinessCard;
use App\Models\Category;
use App\Models\CardTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\Support\StarterTemplates;
use Tests\TestCase;

// Multi card view: the card link shows the business's card and then other
// ready-made designs as a slider, each downloadable as its own PDF.
class MultiCardViewTest extends TestCase
{
    use RefreshDatabase;

    private Business $business;

    private array $auth;

    private CardTemplate $gold;

    private CardTemplate $blue;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.disks.spaces.url' => 'https://cdn.example.test', 'app.url' => 'https://markkito.test']);
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);
        StarterTemplates::install();
        $owner = User::create([
            'email' => 'owner-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'O', 'lastName' => 'W', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER',
        ]);
        $this->business = Business::create([
            'ownerId' => $owner->id, 'name' => 'Spice Garden', 'slug' => 'spice-garden', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '98765 43210', 'addressLine1' => '1 Main St', 'city' => 'Kochi', 'state' => 'KL', 'latitude' => 9.9, 'longitude' => 76.2,
        ]);
        $spot = ['action' => 'call', 'x' => 10, 'y' => 80, 'w' => 30, 'h' => 8, 'style' => 'button'];
        $make = fn (string $name, int $order) => CardTemplate::create([
            'categoryId' => $category->id, 'name' => $name, 'slug' => \Illuminate\Support\Str::slug($name).'-'.uniqid(), 'layout' => 'classic',
            'design' => [], 'isActive' => true, 'sortOrder' => 100 + $order,
            'imageUrl' => 'https://cdn.example.test/cards/'.\Illuminate\Support\Str::slug($name).'.png', 'imageWidth' => 200, 'imageHeight' => 120,
            'hotspots' => [$spot],
        ]);
        $this->gold = $make('Gold Card', 1);
        $this->blue = $make('Blue Card', 2);
        BusinessCard::create(['businessId' => $this->business->id, 'isPublished' => true, 'publishedAt' => now(),
            'imageUrl' => 'https://cdn.example.test/cards/own.png', 'imageWidth' => 200, 'imageHeight' => 120, 'hotspots' => [$spot]]);

        $token = $this->postJson('/api/v1/auth/login', ['email' => $owner->email, 'password' => 'Password123!'])->json('data.accessToken');
        $this->auth = ['Authorization' => "Bearer {$token}"];

        $img = imagecreatetruecolor(200, 120);
        ob_start();
        imagepng($img);
        Http::fake(['cdn.example.test/*' => Http::response(ob_get_clean(), 200, ['Content-Type' => 'image/png'])]);
    }

    public function test_the_link_shows_one_card_until_multi_view_is_turned_on(): void
    {
        $this->get('/card/spice-garden')->assertOk()->assertSee('cards/own.png', false)->assertDontSee('data-track', false);

        // Owners can turn it on; the designs are listed for picking.
        $designs = $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)->assertOk()
            ->assertJsonPath('data.multiView', false)->json('data.extraDesigns.*.id');
        $this->assertContains($this->gold->id, $designs);
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['multiView' => true, 'extraTemplateIds' => [$this->gold->id]], $this->auth)
            ->assertOk()->assertJsonPath('data.multiView', true);

        $page = $this->get('/card/spice-garden')->assertOk()->assertSee('data-track', false)->getContent();
        $this->assertStringContainsString('design=main&amp;embed=1', $page);
        $this->assertStringContainsString("design={$this->gold->id}&amp;embed=1", $page);
        $this->assertStringNotContainsString($this->blue->id, $page);
        $this->assertSame(2, BusinessCard::where('businessId', $this->business->id)->value('viewCount'));

        // Each slide is the real card; an embedded slide doesn't count as a view.
        $this->get("/card/spice-garden?design={$this->gold->id}&embed=1")->assertOk()->assertSee('gold-card.png', false);
        $this->get('/card/spice-garden?design=main&embed=1')->assertOk()->assertSee('cards/own.png', false);
        $this->get("/card/spice-garden?design={$this->blue->id}&embed=1")->assertNotFound();
        $this->assertSame(2, BusinessCard::where('businessId', $this->business->id)->value('viewCount'));

        // None picked = every design.
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['extraTemplateIds' => null], $this->auth)->assertOk();
        $this->assertStringContainsString($this->blue->id, $this->get('/card/spice-garden')->getContent());
    }

    public function test_each_slide_downloads_its_own_pdf(): void
    {
        BusinessCard::where('businessId', $this->business->id)->update(['multiView' => true]);
        $this->business->refresh();

        $this->get('/card/spice-garden.pdf')->assertOk()
            ->assertHeader('Content-Disposition', 'attachment; filename="spice-garden-visiting-card.pdf"');
        $res = $this->get("/card/spice-garden.pdf?design={$this->gold->id}")->assertOk()
            ->assertHeader('Content-Disposition', "attachment; filename=\"spice-garden-{$this->gold->slug}-visiting-card.pdf\"");
        $this->assertStringStartsWith('%PDF-', $res->getContent());

        // Only the designs in its slider.
        $this->get('/card/spice-garden.pdf?design='.\Illuminate\Support\Str::uuid())->assertNotFound();
        BusinessCard::where('businessId', $this->business->id)->update(['multiView' => false]);
        $this->get("/card/spice-garden.pdf?design={$this->gold->id}")->assertNotFound();
    }

    public function test_only_offered_designs_can_be_picked(): void
    {
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['multiView' => true, 'extraTemplateIds' => [(string) \Illuminate\Support\Str::uuid()]], $this->auth)
            ->assertStatus(400);
    }
}
