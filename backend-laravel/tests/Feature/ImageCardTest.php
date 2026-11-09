<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\BusinessCard;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// Image cards: the business uploads its own card artwork and places
// tappable actions on it; the public card and the PDF link each one.
class ImageCardTest extends TestCase
{
    use RefreshDatabase;

    private Business $business;

    private array $auth;

    private string $ownerEmail;

    private string $dealerEmail;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.disks.spaces.url' => 'https://cdn.example.test', 'app.url' => 'https://markkito.test']);
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);
        $owner = User::create([
            'email' => 'owner-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'O', 'lastName' => 'W', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER',
        ]);
        // The card design is edited by the dealer who set the business up, not its owner.
        $dealer = User::create([
            'email' => 'dealer-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'D', 'lastName' => 'L', 'status' => 'ACTIVE', 'role' => 'DEALER', 'privileges' => ['MANAGE_LISTINGS'],
        ]);
        $this->business = Business::create([
            'ownerId' => $owner->id, 'createdById' => $dealer->id, 'name' => 'Spice Garden', 'slug' => 'spice-garden', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '98765 43210', 'email' => 'hi@spice.test',
            'addressLine1' => '1 Main St', 'city' => 'Kochi', 'state' => 'KL', 'latitude' => 9.9, 'longitude' => 76.2,
        ]);
        $this->ownerEmail = $owner->email;
        $this->dealerEmail = $dealer->email;
        $token = $this->postJson('/api/v1/auth/login', ['email' => $dealer->email, 'password' => 'Password123!'])->json('data.accessToken');
        $this->auth = ['Authorization' => "Bearer {$token}"];

        $img = imagecreatetruecolor(600, 1000);
        imagefill($img, 0, 0, imagecolorallocate($img, 20, 60, 120));
        ob_start();
        imagejpeg($img);
        Http::fake(['cdn.example.test/*' => Http::response(ob_get_clean(), 200, ['Content-Type' => 'image/jpeg'])]);
    }

    private function spot(string $action, array $extra = []): array
    {
        return ['id' => 'h-'.$action, 'action' => $action, 'x' => 10, 'y' => 70, 'w' => 30, 'h' => 8, ...$extra];
    }

    public function test_business_owners_see_their_card_but_cannot_edit_its_design(): void
    {
        $this->save([$this->spot('call'), $this->spot('instagram'), $this->spot('logo')])->assertOk();

        $token = $this->postJson('/api/v1/auth/login', ['email' => $this->ownerEmail, 'password' => 'Password123!'])->json('data.accessToken');
        $owner = ['Authorization' => "Bearer {$token}"];

        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['hotspots' => [$this->spot('email')]], $owner)->assertStatus(403);
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['imageUrl' => null], $owner)->assertStatus(403);
        $this->assertCount(3, BusinessCard::where('businessId', $this->business->id)->value('hotspots'));

        // They still see the card, with what their listing lacks for it.
        $this->getJson("/api/v1/businesses/{$this->business->id}/card", $owner)->assertOk()
            ->assertJsonPath('data.canEdit', false)
            ->assertJsonPath('data.missingDetails', [
                ['key' => 'instagram', 'label' => 'Instagram', 'section' => 'Social Media'],
                ['key' => 'logo', 'label' => 'Logo', 'section' => 'Contact'],
            ]);
        $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)->assertOk()->assertJsonPath('data.canEdit', true);

        // The owner's preview looks like the public card: no outlines over the
        // tap areas, and no stand-ins for actions with nowhere to go (Instagram).
        $outline = 'box-shadow:inset 0 0 0 2px rgba(250,204,21,.85)';
        $ownerHtml = $this->getJson("/api/v1/businesses/{$this->business->id}/card", $owner)->json('data.imagePreviewHtml');
        $this->assertStringNotContainsString($outline, $ownerHtml);
        $this->assertStringNotContainsString('aria-label="Instagram"', $ownerHtml);
        $this->assertStringContainsString('aria-label="Call"', $ownerHtml);
        $body = ['imageUrl' => 'https://cdn.example.test/cards/images/card.jpg', 'hotspots' => [$this->spot('call')]];
        $this->assertStringNotContainsString($outline, $this->postJson("/api/v1/businesses/{$this->business->id}/card/preview", $body, $owner)->json('data.html'));
        // The dealer's editor preview keeps them.
        $dealerHtml = $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)->json('data.imagePreviewHtml');
        $this->assertStringContainsString($outline, $dealerHtml);
        $this->assertStringContainsString('aria-label="Instagram"', $dealerHtml);
    }

    private function save(array $hotspots)
    {
        return $this->putJson("/api/v1/businesses/{$this->business->id}/card", [
            'imageUrl' => 'https://cdn.example.test/cards/images/card.jpg', 'imageWidth' => 600, 'imageHeight' => 1000,
            'hotspots' => $hotspots,
        ], $this->auth);
    }

    public function test_actions_are_saved_kept_inside_the_image_and_shown_as_links_on_the_public_card(): void
    {
        $this->save([
            $this->spot('call'),
            // Dragged past the right edge: pulled back inside.
            $this->spot('whatsapp', ['x' => 95, 'value' => '91234 56789', 'style' => 'button']),
            $this->spot('directions'),
            $this->spot('link', ['value' => 'https://menu.spice.test', 'label' => 'Our menu']),
            // No website on the listing and none given: left off the public card.
            $this->spot('website'),
        ])->assertOk()->assertJsonPath('data.hotspots.1.x', 70)->assertJsonCount(5, 'data.hotspots');

        $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)
            ->assertJsonPath('data.imageUrl', 'https://cdn.example.test/cards/images/card.jpg')
            ->assertJsonPath('data.listingDefaults.call', '98765 43210')
            ->assertJsonPath('data.hotspots.3.label', 'Our menu');

        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $page = $this->get('/card/spice-garden')->assertOk()
            ->assertSee('https://cdn.example.test/cards/images/card.jpg', false)
            ->assertSee('href="tel:9876543210"', false)
            ->assertSee('href="https://wa.me/919123456789"', false)
            ->assertSee('https://menu.spice.test', false)
            ->assertSee('aria-label="Our menu"', false)
            ->assertSee('left:70%', false);
        $this->assertStringNotContainsString('aria-label="Website"', $page->getContent());
    }

    public function test_bad_values_and_unsafe_links_are_refused(): void
    {
        $this->save([$this->spot('link', ['value' => 'javascript:alert(1)'])])->assertStatus(400);
        $this->save([$this->spot('link')])->assertStatus(400);
        $this->save([$this->spot('call', ['value' => '12'])])->assertStatus(400);
        $this->save([$this->spot('teleport')])->assertStatus(400);
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['imageUrl' => "https://x.test/a');}"], $this->auth)->assertStatus(400);
        $this->assertNull(BusinessCard::where('businessId', $this->business->id)->value('imageUrl'));
    }

    public function test_the_pdf_is_the_artwork_with_each_action_a_link(): void
    {
        $this->save([$this->spot('call'), $this->spot('email'), $this->spot('share')])->assertOk();
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();

        $pdf = $this->get('/card/spice-garden.pdf')->assertOk()->assertHeader('Content-Type', 'application/pdf')->getContent();
        preg_match_all('#/URI \((.*?)\)#', $pdf, $m);
        $links = array_map('stripslashes', $m[1]);
        $this->assertContains('tel:9876543210', $links);
        $this->assertContains('mailto:hi@spice.test', $links);
        // The page has the artwork's shape (600 x 1000 at 396pt wide).
        $this->assertMatchesRegularExpression('#/MediaBox \[0(\.0+)? 0(\.0+)? 396(\.0+)? 660(\.0+)?\]#', $pdf);
    }

    public function test_removing_the_image_brings_back_the_template_card(): void
    {
        $this->save([$this->spot('call')])->assertOk();
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['imageUrl' => null], $this->auth)
            ->assertOk()->assertJsonPath('data.imageUrl', null)->assertJsonPath('data.imageWidth', null);
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $this->get('/card/spice-garden')->assertOk()->assertDontSee('cards/images/card.jpg', false)->assertSee('Spice Garden');
    }

    public function test_only_admins_draw_a_free_images_area_dealers_just_place_and_resize_it(): void
    {
        $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)
            ->assertOk()->assertJsonPath('data.canEdit', true)->assertJsonPath('data.imageAreaTools', false);
        $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->admin())
            ->assertOk()->assertJsonPath('data.imageAreaTools', true);
    }

    public function test_facebook_and_youtube_link_however_the_listing_typed_them(): void
    {
        $this->save([$this->spot('facebook'), $this->spot('youtube', ['y' => 80])])->assertOk();
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        // The Reviews & QR form asks for "yourshop or https://facebook.com/yourshop".
        foreach ([
            ['spicegarden', 'mychannel', 'https://www.facebook.com/spicegarden', 'https://www.youtube.com/@mychannel'],
            ['www.facebook.com/spicegarden', '@mychannel', 'https://www.facebook.com/spicegarden', 'https://www.youtube.com/@mychannel'],
            ['https://www.facebook.com/profile.php?id=1000123', 'youtube.com/@mychannel', 'https://www.facebook.com/profile.php?id=1000123', 'https://youtube.com/@mychannel'],
        ] as [$fb, $yt, $fbHref, $ytHref]) {
            $this->business->update(['facebookPageUrl' => $fb, 'youtubeUrl' => $yt]);
            $html = $this->get('/card/spice-garden')->getContent();
            $this->assertStringContainsString('href="'.e($fbHref).'"', $html, "Facebook typed as {$fb}");
            $this->assertStringContainsString('href="'.e($ytHref).'"', $html, "YouTube typed as {$yt}");
        }

        // A box's own address can be typed the same way; nonsense is still refused.
        $this->save([$this->spot('facebook', ['value' => 'fb.com/otherpage'])])->assertOk();
        $this->assertStringContainsString('href="https://fb.com/otherpage"', $this->get('/card/spice-garden')->getContent());
        $this->save([$this->spot('facebook', ['value' => 'javascript:alert(1)'])])->assertStatus(400);
    }

    public function test_save_contact_works_in_previews_before_the_card_is_published(): void
    {
        $this->save([$this->spot('save_contact', ['style' => 'button'])])->assertOk();
        // Not public yet: the public contact file isn't there…
        $this->get('/card/spice-garden.vcf')->assertNotFound();
        // …so the preview's Save contact downloads it from the dashboard instead.
        $html = $this->postJson("/api/v1/businesses/{$this->business->id}/card/preview", [
            'imageUrl' => 'https://cdn.example.test/cards/images/card.jpg', 'imageWidth' => 600, 'imageHeight' => 1000,
            'hotspots' => [$this->spot('save_contact', ['style' => 'button'])],
        ], $this->auth)->assertOk()->json('data.html');
        $this->assertStringContainsString("/dashboard/businesses/{$this->business->id}/card.vcf", $html);

        $this->post('/login', ['email' => $this->dealerEmail, 'password' => 'Password123!']);
        $vcf = $this->get("/dashboard/businesses/{$this->business->id}/card.vcf")->assertOk()
            ->assertHeader('Content-Type', 'text/vcard; charset=UTF-8');
        $this->assertStringContainsString('FN:Spice Garden', $vcf->getContent());
        $this->assertStringContainsString('BEGIN:VCARD', $vcf->getContent());

        // Someone who doesn't manage the business can't fetch it.
        $this->post('/logout');
        $stranger = User::create(['email' => 'x-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'), 'firstName' => 'X', 'lastName' => 'Y', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER']);
        $this->post('/login', ['email' => $stranger->email, 'password' => 'Password123!']);
        $this->get("/dashboard/businesses/{$this->business->id}/card.vcf")->assertForbidden();

        // Once live, the public card links the public file.
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $this->assertStringContainsString('/card/spice-garden.vcf', $this->get('/card/spice-garden')->getContent());
        $this->get('/card/spice-garden.vcf')->assertOk();
    }

    public function test_the_dealer_can_recolour_the_card_on_its_page(): void
    {
        $this->withoutVite();
        $this->save([$this->spot('call')])->assertOk();
        $this->post('/login', ['email' => $this->dealerEmail, 'password' => 'Password123!']);
        $page = $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))->assertOk();
        $page->assertSee('Card design & actions', false)->assertSee('data-colour-panel', false)->assertSee('Card colour');
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['imageColour' => ['tint' => '#2563eb', 'strength' => 60, 'hue' => 0, 'brightness' => 100, 'saturation' => 100]], $this->auth)
            ->assertOk();
    }

    public function test_the_colour_panel_shows_for_a_card_still_wearing_its_categorys_image_design(): void
    {
        $this->withoutVite();
        $this->imageTemplate($this->admin());
        $this->assertNull(BusinessCard::where('businessId', $this->business->id)->first()?->imageUrl);
        $this->post('/login', ['email' => $this->dealerEmail, 'password' => 'Password123!']);
        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))
            ->assertOk()->assertSee('cards/images/template.jpg', false)->assertSee('data-colour-panel', false);
    }

    private function admin(): array
    {
        $admin = User::create([
            'email' => 'admin-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'A', 'lastName' => 'D', 'status' => 'ACTIVE', 'role' => 'ADMIN',
        ]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => 'Password123!'])->json('data.accessToken');

        return ['Authorization' => "Bearer {$token}"];
    }

    // An admin-made image template: the image with actions, created for the category.
    private function imageTemplate(array $admin, array $extra = []): string
    {
        return $this->postJson('/api/v1/admin/card-templates', [
            'name' => 'Gold Image Card', 'layout' => 'classic', 'categoryId' => $this->business->categoryId, 'isDefault' => true,
            'imageUrl' => 'https://cdn.example.test/cards/images/template.jpg', 'imageWidth' => 600, 'imageHeight' => 1000,
            'hotspots' => [$this->spot('call'), $this->spot('directions', ['y' => 80])],
            ...$extra,
        ], $admin)->assertCreated()->assertJsonPath('data.imageUrl', 'https://cdn.example.test/cards/images/template.jpg')
            ->assertJsonCount(2, 'data.hotspots')->json('data.id');
    }

    public function test_admin_builds_an_image_template_whose_actions_use_each_businesss_details(): void
    {
        $admin = $this->admin();
        // Owners can't make templates; bad actions are refused for admins too.
        $this->postJson('/api/v1/admin/card-templates', ['name' => 'X', 'layout' => 'classic'], $this->auth)->assertStatus(403);
        $this->postJson('/api/v1/admin/card-templates', ['name' => 'X', 'layout' => 'classic', 'imageUrl' => 'https://cdn.example.test/a.jpg', 'hotspots' => [$this->spot('link', ['value' => 'javascript:alert(1)'])]], $admin)->assertStatus(400);

        $id = $this->imageTemplate($admin);
        $this->postJson('/api/v1/admin/card-templates/preview', [
            'layout' => 'classic', 'name' => 'Sample Co', 'imageUrl' => 'https://cdn.example.test/cards/images/template.jpg',
            'hotspots' => [$this->spot('call')],
        ], $admin)->assertOk()->assertJsonPath('data.html', fn ($html) => str_contains($html, 'cards/images/template.jpg') && str_contains($html, 'aria-label="Call"'));

        // The business wears its category's default — the image template — with its own phone and address.
        $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)->assertOk()
            ->assertJsonPath('data.imageUrl', 'https://cdn.example.test/cards/images/template.jpg')
            ->assertJsonPath('data.imageFromTemplate', true)
            ->assertJsonPath('data.imageTemplates.0.id', $id)
            ->assertJsonPath('data.imageTemplates.0.inUse', true);
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $this->get('/card/spice-garden')->assertOk()
            ->assertSee('cards/images/template.jpg', false)
            ->assertSee('href="tel:9876543210"', false)
            ->assertSee('query=9.9,76.2', false);

        // The admin's later edits reach the card.
        $this->patchJson("/api/v1/admin/card-templates/{$id}", ['hotspots' => [$this->spot('email')]], $admin)->assertOk();
        $this->get('/card/spice-garden')->assertSee('href="mailto:hi@spice.test"', false)->assertDontSee('tel:9876543210', false);
        $pdf = $this->get('/card/spice-garden.pdf')->assertOk()->getContent();
        $this->assertStringContainsString('/URI (mailto:hi@spice.test)', $pdf);

        // Removing the template's image leaves no size or actions behind.
        $this->patchJson("/api/v1/admin/card-templates/{$id}", ['imageUrl' => null], $admin)->assertOk()->assertJsonPath('data.imageWidth', null);
    }

    public function test_an_owner_customises_a_template_image_and_can_go_back_to_the_original(): void
    {
        $id = $this->imageTemplate($this->admin());

        // Saving from the editor makes the business's own copy.
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", [
            'imageUrl' => 'https://cdn.example.test/cards/images/template.jpg', 'imageWidth' => 600, 'imageHeight' => 1000,
            'hotspots' => [$this->spot('whatsapp')],
        ], $this->auth)->assertOk();
        $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)
            ->assertJsonPath('data.imageFromTemplate', false)->assertJsonPath('data.canResetImage', true)
            ->assertJsonPath('data.hotspots.0.action', 'whatsapp')->assertJsonPath('data.imageTemplates.0.inUse', false);

        // Picking the design again drops the copy.
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['templateId' => $id], $this->auth)->assertOk()
            ->assertJsonPath('data.imageUrl', null);
        $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)
            ->assertJsonPath('data.imageFromTemplate', true)->assertJsonPath('data.hotspots.0.action', 'call');
    }

    public function test_previews_show_unsaved_and_half_typed_actions(): void
    {
        $image = ['imageUrl' => 'https://cdn.example.test/cards/images/new.jpg', 'imageWidth' => 600, 'imageHeight' => 1000];
        $spots = [
            // A link whose address isn't typed yet, and a phone number half-typed.
            $this->spot('link', ['label' => 'Menu']),
            $this->spot('call', ['value' => '98']),
            $this->spot('whatsapp', ['value' => '91234 56789']),
        ];

        // The owner's preview: the editor's unsaved state, with the business's own details.
        $html = $this->postJson("/api/v1/businesses/{$this->business->id}/card/preview", [...$image, 'hotspots' => $spots], $this->auth)
            ->assertOk()->json('data.html');
        $this->assertStringContainsString('cards/images/new.jpg', $html);
        $this->assertStringContainsString('aria-label="Menu"', $html);
        // The half-typed number falls back to the listing's phone; real links open in a new tab.
        $this->assertStringContainsString('href="tel:9876543210"', $html);
        $this->assertMatchesRegularExpression('#href="https://wa.me/919123456789" aria-label="WhatsApp"\s+target="_blank"#', $html);
        $this->assertNull(BusinessCard::where('businessId', $this->business->id)->value('imageUrl'), 'a preview saves nothing');

        // The admin's template preview takes the same unfinished actions.
        $this->postJson('/api/v1/admin/card-templates/preview', ['layout' => 'classic', ...$image, 'hotspots' => $spots], $this->admin())
            ->assertOk()->assertJsonPath('data.html', fn ($h) => str_contains($h, 'cards/images/new.jpg'));
    }

    public function test_each_drawn_action_has_its_own_font_size_and_colours(): void
    {
        $this->save([
            $this->spot('call', ['style' => 'button', 'font' => 'Playfair Display', 'fontSize' => 20, 'bold' => true, 'color' => '#FFEE00', 'bg' => '#123456', 'label' => 'Call us']),
            $this->spot('email', ['style' => 'icon', 'font' => 'Poppins', 'color' => '#000000']),
        ])->assertOk()
            ->assertJsonPath('data.hotspots.0.font', 'Playfair Display')
            ->assertJsonPath('data.hotspots.0.color', '#ffee00')
            ->assertJsonPath('data.hotspots.0.bold', true);

        // Only known fonts and #rrggbb colours get in.
        $this->save([$this->spot('call', ['style' => 'button', 'font' => "Comic Sans'};"])])->assertStatus(400);
        $this->save([$this->spot('call', ['style' => 'button', 'color' => 'red;background:url(x)'])])->assertStatus(400);
        $this->save([$this->spot('call', ['style' => 'text'])])->assertStatus(400);

        $this->save([
            $this->spot('call', ['style' => 'button', 'font' => 'Playfair Display', 'fontSize' => 20, 'bold' => true, 'color' => '#ffee00', 'bg' => '#123456']),
            $this->spot('email', ['style' => 'icon', 'font' => 'Poppins']),
        ])->assertOk();
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $html = $this->get('/card/spice-garden')->assertOk()->getContent();
        $this->assertStringContainsString('family=Playfair+Display', $html);
        $this->assertStringContainsString('family=Poppins', $html);
        $this->assertStringContainsString('font-size:calc(20 * 100cqw / 480)', $html);
        $this->assertStringContainsString('font-weight:700;color:#ffee00;background:#123456', $html);
    }

    public function test_the_business_team_recolours_the_card_image(): void
    {
        $this->save([$this->spot('call')])->assertOk();
        $token = $this->postJson('/api/v1/auth/login', ['email' => $this->ownerEmail, 'password' => 'Password123!'])->json('data.accessToken');
        $owner = ['Authorization' => "Bearer {$token}"];
        $url = "/api/v1/businesses/{$this->business->id}/card";

        // Owners may recolour, though not edit the design.
        $this->putJson($url, ['imageColour' => ['tint' => '#FF0000', 'strength' => 60, 'hue' => 30, 'brightness' => 110, 'saturation' => 80]], $owner)
            ->assertOk()->assertJsonPath('data.imageColour.tint', '#ff0000')->assertJsonPath('data.imageColour.hue', 30);
        $this->putJson($url, ['imageColour' => ['hue' => 400]], $owner)->assertStatus(400);
        $this->putJson($url, ['imageColour' => ['tint' => 'red;}']], $owner)->assertStatus(400);
        $this->getJson($url, $owner)->assertOk()->assertJsonPath('data.imageColour.strength', 60);
        // The owner's preview comes uncoloured: the page lays the colour over it live, so it isn't applied twice.
        $this->assertStringNotContainsString('feColorMatrix', $this->getJson($url, $owner)->json('data.imagePreviewHtml'));
        $this->assertStringContainsString('feColorMatrix', $this->getJson($url, $this->auth)->json('data.imagePreviewHtml'));

        $this->postJson("{$url}/publish", [], $owner)->assertOk();
        $html = $this->get('/card/spice-garden')->assertOk()->getContent();
        $this->assertStringContainsString('<feColorMatrix type="matrix" color-interpolation-filters="sRGB" values="', $html);
        // The browser recolours only the image; the buttons' and text's colours are recoloured on the server (phones draw a filter over them wrong).
        $this->assertStringContainsString('.card > img{filter:url(#card-colour)}', $html);
        $this->assertStringNotContainsString('.card{filter:', $html);
        $this->assertStringContainsString('content="only light"', $html);
        // The PDF recolours text and button colours with the same maths: grey turns red.
        $red = \App\Support\Cards\ImageColour::hex('#808080', \App\Support\Cards\ImageColour::normalize(['tint' => '#ff0000', 'strength' => 100]));
        $this->assertMatchesRegularExpression('/^#[c-f][0-9a-f]0000$/', $red);
        $this->assertStringStartsWith('%PDF', $this->get('/card/spice-garden.pdf')->assertOk()->getContent());

        // The same maths on the pixels: a red tint makes a grey pixel red.
        $img = imagecreatetruecolor(1, 1);
        imagefill($img, 0, 0, imagecolorallocate($img, 128, 128, 128));
        \App\Support\Cards\ImageColour::applyGd($img, \App\Support\Cards\ImageColour::normalize(['tint' => '#ff0000', 'strength' => 100]));
        $rgb = imagecolorat($img, 0, 0);
        $this->assertGreaterThan(200, ($rgb >> 16) & 0xFF);
        $this->assertSame(0, ($rgb >> 8) & 0xFF);

        // Settings that change nothing are stored as nothing; then no filter is drawn.
        $this->putJson($url, ['imageColour' => ['hue' => 0, 'brightness' => 100, 'saturation' => 100]], $owner)->assertOk()->assertJsonPath('data.imageColour', null);
        $this->assertStringNotContainsString('feColorMatrix', $this->get('/card/spice-garden')->getContent());

        // The owner's Visiting Card page has the one-tap colour swatches.
        $this->withoutVite();
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))->assertOk()
            ->assertSee('data-colour-panel', false)->assertDontSee('data-colour-thumb', false)->assertSee('Tap a colour')->assertSee('data-swatch="gold"', false)
            ->assertSee('Black &amp; white', false)->assertSee('Fine-tune');

        // A preview shows unsaved colours.
        $this->postJson("{$url}/preview", ['imageUrl' => 'https://cdn.example.test/cards/images/card.jpg', 'imageColour' => ['saturation' => 0]], $owner)
            ->assertOk()->assertSee('feColorMatrix', false);
    }

    public function test_the_colour_can_cover_only_marked_areas_with_erased_parts(): void
    {
        $this->save([$this->spot('custom_text', ['value' => 'Hello', 'color' => '#808080'])])->assertOk();
        $url = "/api/v1/businesses/{$this->business->id}/card";
        $square = [[0, 0], [50, 0], [50, 50], [0, 50]];
        // Marking where the colour goes is for admins.
        User::create([
            'email' => 'admin-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'A', 'lastName' => 'D', 'status' => 'ACTIVE', 'role' => 'ADMIN',
        ]);
        $adminEmail = User::where('role', 'ADMIN')->value('email');
        $admin = ['Authorization' => 'Bearer '.$this->postJson('/api/v1/auth/login', ['email' => $adminEmail, 'password' => 'Password123!'])->json('data.accessToken')];
        $this->putJson($url, ['imageColour' => ['tint' => '#ff0000', 'strength' => 100, 'areas' => [['points' => $square]]]], $this->auth)
            ->assertOk()->assertJsonPath('data.imageColour.areas', []);
        $this->putJson($url, ['imageColour' => ['tint' => '#ff0000', 'strength' => 100, 'areas' => [
            // An eraser before anything is coloured does nothing: dropped.
            ['erase' => true, 'points' => [[1, 1], [2, 1], [2, 2]]],
            ['points' => $square],
            ['erase' => true, 'points' => [[0, 0], [10, 0], [10, 10]]],
            // Points past the edge are pulled back inside the image.
            ['points' => [[120, -5], [60, 60], [60, 90]]],
        ]]], $admin)->assertOk()
            ->assertJsonCount(3, 'data.imageColour.areas')
            ->assertJsonPath('data.imageColour.areas.0.erase', false)
            ->assertJsonPath('data.imageColour.areas.1.erase', true)
            ->assertJsonPath('data.imageColour.areas.2.points.0', [100, 0]);
        $this->putJson($url, ['imageColour' => ['tint' => '#ff0000', 'areas' => [['points' => [[1, 2]]]]]], $admin)->assertStatus(400);
        // A dealer picking another colour keeps the admin's areas, and can't change them.
        $this->putJson($url, ['imageColour' => ['tint' => '#00ff00', 'strength' => 100, 'areas' => []]], $this->auth)
            ->assertOk()->assertJsonPath('data.imageColour.tint', '#00ff00')->assertJsonCount(3, 'data.imageColour.areas');
        $this->putJson($url, ['imageColour' => ['tint' => '#ff0000', 'strength' => 100, 'areas' => [['points' => $square]]]], $this->auth)
            ->assertOk()->assertJsonCount(3, 'data.imageColour.areas');
        // Only the admin's Visiting Card page offers marking them.
        $this->withoutVite();
        $section = "/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card');
        $this->post('/login', ['email' => $this->dealerEmail, 'password' => 'Password123!']);
        $this->get($section)->assertOk()->assertDontSee('data-areas-edit', false)->assertSee('your admin marked');
        $this->post('/logout');
        $this->post('/login', ['email' => $adminEmail, 'password' => 'Password123!']);
        $this->get($section)->assertOk()->assertSee('data-areas-edit', false);
        $this->post('/logout');

        // The public card: the image unfiltered, a recoloured copy masked to the areas, text left alone.
        $this->postJson("{$url}/publish", [], $this->auth)->assertOk();
        $html = $this->get('/card/spice-garden')->assertOk()->getContent();
        $this->assertStringContainsString('<img class="colour-areas"', $html);
        $this->assertStringContainsString('mask:url("data:image/svg+xml,', $html);
        $this->assertStringNotContainsString('.card > img{filter:url(#card-colour)}', $html);
        $this->assertStringContainsString('color:#808080', $html);

        // The PDF recolours only the pixels inside the areas, less what's erased.
        $c = \App\Support\Cards\ImageColour::normalize(['tint' => '#ff0000', 'strength' => 100, 'areas' => [['points' => $square], ['erase' => true, 'points' => [[0, 0], [20, 0], [20, 20], [0, 20]]]]]);
        $img = imagecreatetruecolor(100, 100);
        imagefill($img, 0, 0, imagecolorallocate($img, 128, 128, 128));
        \App\Support\Cards\ImageColour::applyGd($img, $c);
        $red = fn (int $x, int $y) => (imagecolorat($img, $x, $y) >> 8 & 0xFF) === 0;
        $this->assertTrue($red(35, 35), 'inside the area');
        $this->assertFalse($red(80, 80), 'outside it');
        $this->assertFalse($red(5, 5), 'erased');
        $this->assertStringStartsWith('%PDF', $this->get('/card/spice-garden.pdf')->assertOk()->getContent());

        // No areas: the whole card again.
        $this->putJson($url, ['imageColour' => ['tint' => '#ff0000', 'strength' => 100, 'areas' => []]], $admin)->assertOk();
        $this->assertStringContainsString('.card > img{filter:url(#card-colour)}', $this->get('/card/spice-garden')->getContent());
    }

    public function test_custom_text_is_drawn_in_its_own_font_size_and_style(): void
    {
        $this->save([
            $this->spot('custom_text', ['value' => "Free home delivery\nOrder by 9pm", 'font' => 'Playfair Display', 'fontSize' => 22, 'bold' => true, 'italic' => true, 'color' => '#AA0000', 'align' => 'center']),
            // Typed nothing: left off the card.
            $this->spot('custom_text', ['id' => 'h-empty']),
        ])->assertOk()
            ->assertJsonPath('data.hotspots.0.value', "Free home delivery\nOrder by 9pm")
            ->assertJsonPath('data.hotspots.0.italic', true)
            ->assertJsonPath('data.hotspots.1.italic', false);

        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $html = $this->get('/card/spice-garden')->assertOk()->getContent();
        $this->assertStringContainsString("Free home delivery\nOrder by 9pm", $html);
        $this->assertStringContainsString('family=Playfair+Display', $html);
        $this->assertStringContainsString('font-size:calc(22 * 100cqw / 480)', $html);
        $this->assertStringContainsString('font-weight:700;font-style:italic;color:#aa0000', $html);
        $this->assertSame(1, substr_count($html, 'class="spot detail"'));

        // Custom text isn't a listing detail, so it's never reported as missing.
        $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)->assertOk()->assertJsonPath('data.missingDetails', []);
        $this->get('/card/spice-garden.pdf')->assertOk();
    }

    public function test_business_details_are_drawn_on_the_card_from_the_listing(): void
    {
        $this->business->update(['logoUrl' => 'https://cdn.example.test/logo.jpg', 'description' => "Kerala meals\nand seafood"]);
        $this->save([
            $this->spot('name', ['font' => 'Poppins', 'fontSize' => 26, 'bold' => true, 'color' => '#111827', 'align' => 'center']),
            $this->spot('address'),
            $this->spot('phone_text'),
            $this->spot('email_text', ['value' => 'orders@spice.test']),
            $this->spot('about'),
            $this->spot('tagline', ['value' => 'Since 1998']),
            $this->spot('logo'),
            $this->spot('qr'),
            // Nothing on the listing to show: left off the card.
            $this->spot('hours'),
            $this->spot('website_text'),
        ])->assertOk()
            ->assertJsonPath('data.hotspots.0.style', null)
            ->assertJsonPath('data.hotspots.0.align', 'center');
        // A detail's own value is checked like its action's.
        $this->save([$this->spot('email_text', ['value' => 'not an email'])])->assertStatus(400);
        $this->save([
            $this->spot('name', ['font' => 'Poppins', 'fontSize' => 26, 'bold' => true, 'color' => '#111827', 'align' => 'center']),
            $this->spot('address'), $this->spot('phone_text'), $this->spot('email_text', ['value' => 'orders@spice.test']),
            $this->spot('about'), $this->spot('tagline', ['value' => 'Since 1998']), $this->spot('logo'), $this->spot('qr'),
            $this->spot('hours'), $this->spot('website_text'),
        ])->assertOk();

        $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)
            ->assertJsonPath('data.listingDefaults.name', 'Spice Garden')
            ->assertJsonPath('data.listingDefaults.address', '1 Main St, Kochi, KL')
            ->assertJsonPath('data.actions.12.kind', 'text');

        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $html = $this->get('/card/spice-garden')->assertOk()->getContent();
        $this->assertMatchesRegularExpression('#<div class="spot detail"[^>]*text-align:center[^>]*><span>Spice Garden</span>#', $html);
        // Linked details: the address opens directions, the phone calls, the email writes.
        $this->assertMatchesRegularExpression('#<a class="spot detail"[^>]*href="https://www.google.com/maps/search/\?api=1&amp;query=9.9,76.2"[^>]*><span>1 Main St, Kochi, KL</span>#', $html);
        $this->assertMatchesRegularExpression('#href="tel:9876543210"[^>]*><span>98765 43210</span>#', $html);
        $this->assertMatchesRegularExpression('#href="mailto:orders@spice.test"[^>]*><span>orders@spice.test</span>#', $html);
        $this->assertStringContainsString("<span>Kerala meals\nand seafood</span>", $html);
        $this->assertStringContainsString('<span>Since 1998</span>', $html);
        $this->assertStringContainsString('<img src="https://cdn.example.test/logo.jpg" alt="Spice Garden logo"', $html);
        $this->assertStringContainsString('alt="QR code for this card"', $html);
        $this->assertStringContainsString('src="data:image/png;base64,', $html);
        // No hours or website on the listing: those boxes aren't drawn.
        $this->assertSame(6, substr_count($html, '<div class="spot detail"') + substr_count($html, '<a class="spot detail"'));

        // The PDF prints the details too, with their links.
        $pdf = $this->get('/card/spice-garden.pdf')->assertOk()->getContent();
        $this->assertStringContainsString('/URI (mailto:orders@spice.test)', $pdf);
        $this->assertStringContainsString('/URI (tel:9876543210)', $pdf);
    }

    public function test_a_logo_box_can_show_its_own_uploaded_logo(): void
    {
        // No logo on the listing: the box would be left off the card…
        $this->save([$this->spot('logo')])->assertOk();
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $this->assertStringNotContainsString('alt="Spice Garden logo"', $this->get('/card/spice-garden')->getContent());

        // …until a logo is uploaded onto it.
        $this->save([$this->spot('logo', ['value' => 'https://cdn.example.test/cards/images/my-logo.png'])])
            ->assertOk()->assertJsonPath('data.hotspots.0.value', 'https://cdn.example.test/cards/images/my-logo.png');
        $this->assertStringContainsString('<img src="https://cdn.example.test/cards/images/my-logo.png" alt="Spice Garden logo"', $this->get('/card/spice-garden')->getContent());

        // It wins over the listing's logo, and must be a picture address.
        $this->business->update(['logoUrl' => 'https://cdn.example.test/logo.jpg']);
        $this->assertStringContainsString('cards/images/my-logo.png', $this->get('/card/spice-garden')->getContent());
        $this->save([$this->spot('logo', ['value' => 'javascript:alert(1)'])])->assertStatus(400);
    }

    public function test_a_logo_can_have_rounded_corners(): void
    {
        $logo = ['value' => 'https://cdn.example.test/cards/images/my-logo.png'];
        $this->save([$this->spot('logo', $logo + ['radius' => 50])])->assertOk()->assertJsonPath('data.hotspots.0.radius', 50);
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $html = $this->get('/card/spice-garden')->getContent();
        $this->assertStringContainsString('height:8%;border-radius:50%">', $html);
        $this->assertStringContainsString('style="object-fit:cover;border-radius:50%"', $html);

        // Square again: no rounding drawn; more than round is refused; only a logo keeps it.
        $this->save([$this->spot('logo', $logo + ['radius' => 0])])->assertOk()->assertJsonPath('data.hotspots.0.radius', null);
        $this->assertStringNotContainsString('border-radius:0%', $this->get('/card/spice-garden')->getContent());
        $this->save([$this->spot('logo', $logo + ['radius' => 80])])->assertStatus(400);
        $this->save([$this->spot('call', ['radius' => 20])])->assertOk()->assertJsonPath('data.hotspots.0.radius', null);
    }

    public function test_a_free_image_is_drawn_in_its_own_shape_anywhere_on_the_card(): void
    {
        // Without a picture it's left off the card.
        $this->save([$this->spot('custom_image')])->assertOk();
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $this->assertStringNotContainsString('class="spot pic"', $this->get('/card/spice-garden')->getContent());

        // A wide picture in a wide box: shown whole, with no rounding or shape.
        $pic = ['value' => 'https://cdn.example.test/cards/images/offer.png', 'x' => 5, 'y' => 40, 'w' => 90, 'h' => 12];
        $this->save([$this->spot('custom_image', $pic)])->assertOk()
            ->assertJsonPath('data.hotspots.0.value', 'https://cdn.example.test/cards/images/offer.png')
            ->assertJsonPath('data.hotspots.0.w', 90);
        $html = $this->get('/card/spice-garden')->getContent();
        $this->assertStringContainsString('width:90%;height:12%;border-radius:0">', $html);
        $this->assertStringContainsString('<img src="https://cdn.example.test/cards/images/offer.png" alt=""', $html);

        // It can be rounded like the logo, and must be a picture address.
        $this->save([$this->spot('custom_image', $pic + ['radius' => 20])])->assertOk()->assertJsonPath('data.hotspots.0.radius', 20);
        $this->save([$this->spot('custom_image', ['value' => 'javascript:alert(1)'])])->assertStatus(400);
    }

    public function test_a_picture_can_be_cut_to_a_shape_drawn_on_the_card(): void
    {
        $pic = ['value' => 'https://cdn.example.test/cards/images/offer.png'];
        $triangle = [[50, 0], [100, 100], [0, 100]];
        $this->save([$this->spot('custom_image', $pic + ['shape' => $triangle]), $this->spot('logo', $pic + ['shape' => [[0, 0], [100, 0], [50, 100]]])])
            ->assertOk()
            ->assertJsonPath('data.hotspots.0.shape', [[50, 0], [100, 100], [0, 100]])
            ->assertJsonPath('data.hotspots.1.shape.2', [50, 100]);
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $html = $this->get('/card/spice-garden')->getContent();
        $this->assertStringContainsString('clip-path:polygon(50% 0%,100% 100%,0% 100%)', $html);
        $this->assertStringContainsString('style="object-fit:cover"', $html);

        // Fewer than 3 points, or points outside the box, are refused; other boxes never keep a shape.
        $this->save([$this->spot('custom_image', $pic + ['shape' => [[0, 0], [10, 10]]])])->assertStatus(400);
        $this->save([$this->spot('custom_image', $pic + ['shape' => [[0, 0], [10, 10], [150, 5]]])])->assertStatus(400);
        $this->save([$this->spot('call', ['shape' => $triangle])])->assertOk()->assertJsonPath('data.hotspots.0.shape', null);
    }

    public function test_a_picture_fills_the_area_marked_for_it_moved_and_zoomed(): void
    {
        $area = ['value' => 'https://cdn.example.test/cards/images/shop.jpg', 'shape' => [[0, 0], [100, 0], [100, 100], [0, 100]]];
        // Moved and zoomed: the picture's rectangle in percent of the area, always covering it.
        $fit = ['l' => -40, 't' => -25.5, 'w' => 180, 'h' => 150];
        $this->save([$this->spot('custom_image', $area + ['fit' => $fit])])
            ->assertOk()->assertJsonPath('data.hotspots.0.fit', ['l' => -40, 't' => -25.5, 'w' => 180, 'h' => 150]);
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $this->assertStringContainsString(
            'style="position:absolute;left:-40%;top:-25.5%;width:180%;height:150%;max-width:none;object-fit:cover"',
            $this->get('/card/spice-garden')->getContent(),
        );

        // Never leaves a gap: an edge pulled inside the area is pushed back out.
        $this->save([$this->spot('custom_image', $area + ['fit' => ['l' => -10, 't' => 0, 'w' => 105, 'h' => 120]])])
            ->assertOk()->assertJsonPath('data.hotspots.0.fit', ['l' => -5, 't' => 0, 'w' => 105, 'h' => 120]);

        // No position = centred and covering; smaller than the area is refused; only free images keep it.
        $this->save([$this->spot('custom_image', $area)])->assertOk()->assertJsonPath('data.hotspots.0.fit', null);
        $this->assertStringContainsString('<img src="https://cdn.example.test/cards/images/shop.jpg" alt="" style="object-fit:cover"', $this->get('/card/spice-garden')->getContent());
        $this->save([$this->spot('custom_image', $area + ['fit' => ['l' => 0, 't' => 0, 'w' => 60, 'h' => 100]])])->assertStatus(400);
        $this->save([$this->spot('logo', $area + ['fit' => $fit])])->assertOk()->assertJsonPath('data.hotspots.0.fit', null);
    }

    public function test_review_us_on_google_and_location_actions(): void
    {
        $this->save([
            $this->spot('google_review', ['style' => 'button']),
            ['id' => 'h-loc', 'action' => 'directions', 'x' => 50, 'y' => 70, 'w' => 30, 'h' => 8, 'style' => 'button'],
        ])->assertOk();
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();

        // No review link on the listing yet: the box is left off, and the editor says where to add it.
        $html = $this->get('/card/spice-garden')->getContent();
        $this->assertStringNotContainsString('writereview', $html);
        $this->assertStringContainsString('<span>Location</span>', $html);
        $this->assertStringContainsString('query=9.9,76.2', $html);
        $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)
            ->assertJsonFragment(['label' => 'Google review link', 'section' => 'Social Media']);

        // With a Google Place ID, it opens Google's "write a review" page.
        $this->business->update(['googlePlaceId' => 'ChIJ123abc']);
        $html = $this->get('/card/spice-garden')->getContent();
        $this->assertStringContainsString('href="https://search.google.com/local/writereview?placeid=ChIJ123abc"', $html);
        $this->assertStringContainsString('<span>Review us on Google</span>', $html);

        // A link typed on the card wins; it must be a web address.
        $this->save([$this->spot('google_review', ['value' => 'https://g.page/r/spice/review'])])->assertOk();
        $this->assertStringContainsString('href="https://g.page/r/spice/review"', $this->get('/card/spice-garden')->getContent());
        $this->save([$this->spot('google_review', ['value' => 'javascript:alert(1)'])])->assertStatus(400);
    }

    public function test_layout_cards_show_location_and_review_buttons(): void
    {
        $this->business->update(['googleReviewUrl' => 'https://g.page/r/spice/review']);
        $details = \App\Support\Cards\CardEngine::details($this->business->fresh());
        $html = \App\Support\Cards\CardEngine::render(null, $details);
        $this->assertStringContainsString('<span>Location</span>', $html);
        $this->assertStringContainsString('href="https://g.page/r/spice/review"', $html);
        $this->assertStringContainsString('<span>Review us</span>', $html);
    }

    public function test_the_owner_changes_the_colour_from_the_public_card_link(): void
    {
        $this->save([$this->spot('call')])->assertOk();
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['imageColour' => ['tint' => '#16a34a', 'strength' => 60]], $this->auth)->assertOk();
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();

        // Visitors: just the card.
        $this->assertStringNotContainsString('mk-owner-bar', $this->get('/card/spice-garden')->assertOk()->getContent());

        // Signed in as the owner: the colour bar, with the card's colour picked, and never cached.
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $page = $this->get('/card/spice-garden')->assertOk()
            ->assertSee('id="mk-owner-bar"', false)
            ->assertSee("/api/v1/businesses/{$this->business->id}/card", false)
            ->assertSee('?section=Visiting+Card', false);
        $this->assertStringContainsString('no-store', $page->headers->get('Cache-Control'));
        $this->assertMatchesRegularExpression('~title="Green" aria-label="Green" aria-checked="true"~', $page->getContent());
        // Inside the page, not after it.
        $this->assertLessThan(strrpos($page->getContent(), '</body>'), strpos($page->getContent(), 'id="mk-owner-bar"'));

        // Someone signed in who doesn't manage it: no bar.
        $this->post('/logout');
        $stranger = User::create([
            'email' => 'other-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'S', 'lastName' => 'T', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER',
        ]);
        $this->post('/login', ['email' => $stranger->email, 'password' => 'Password123!']);
        $this->assertStringNotContainsString('mk-owner-bar', $this->get('/card/spice-garden')->assertOk()->getContent());
    }

    public function test_missing_card_details_get_a_textbox_on_the_visiting_card_section(): void
    {
        $this->save([$this->spot('instagram'), $this->spot('logo'), $this->spot('whatsapp')])->assertOk();
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))->assertOk()
            ->assertSee('data-missing-form data-via="links"', false)
            ->assertSee('name="instagramUsername"', false)
            // A logo needs an upload: it keeps its link to Contact.
            ->assertSee('Add in Contact', false);
    }

    public function test_a_card_made_from_a_big_phone_photo_downloads_as_a_pdf_within_memory(): void
    {
        // A 12-megapixel photo, as a phone takes it: the card image and a free image on it.
        $path = public_path('test-big-card-'.uniqid().'.jpg');
        $img = imagecreatetruecolor(3000, 4000);
        // Full of detail, like a real photo (a plain one squeezes too small to test anything).
        mt_srand(7);
        for ($y = 0; $y < 4000; $y += 4) {
            for ($x = 0; $x < 3000; $x += 4) {
                imagefilledrectangle($img, $x, $y, $x + 3, $y + 3, mt_rand(0, 0xFFFFFF));
            }
        }
        imagejpeg($img, $path, 90);
        // Four more big pictures placed on it as free images, each a different photo.
        $pics = [];
        foreach ([0, 1, 2, 3] as $i) {
            $pics[$i] = public_path('test-big-pic-'.uniqid()."-{$i}.jpg");
            $crop = imagecrop($img, ['x' => 0, 'y' => $i * 50, 'width' => 3000, 'height' => 3800]);
            imagejpeg($crop, $pics[$i], 90);
        }
        unset($img, $crop);
        $url = '/'.basename($path);
        $free = array_map(fn ($i) => ['id' => "pic{$i}", 'action' => 'custom_image', 'x' => 5 + $i * 20, 'y' => 10, 'w' => 18, 'h' => 20, 'value' => '/'.basename($pics[$i])], array_keys($pics));
        try {
            BusinessCard::updateOrCreate(['businessId' => $this->business->id], [
                'imageUrl' => $url, 'imageWidth' => 3000, 'imageHeight' => 4000, 'isPublished' => true,
                'hotspots' => [$this->spot('call'), ...$free],
                'imageColour' => ['tint' => '#ff0000', 'strength' => 80, 'areas' => [['erase' => false, 'points' => [[0, 0], [60, 0], [60, 60], [0, 60]]]]],
            ]);
            memory_reset_peak_usage();
            $before = memory_get_usage();
            $pdf = $this->get('/card/spice-garden.pdf')->assertOk()->getContent();
            $this->assertStringStartsWith("%PDF", $pdf);
            fwrite(STDERR, "IMAGES: ".preg_match_all("~/Subtypes*/Image~", $pdf)." SIZE MB: ".round(strlen($pdf) / 1048576, 1)."
");
            // Well inside the 256MB the live server allows.
            fwrite(STDERR, "PEAK MB: ".round((memory_get_peak_usage() - $before) / 1048576)."
");
            $this->assertLessThan(200 * 1024 * 1024, memory_get_peak_usage() - $before);
        } finally {
            @unlink($path);
            array_map('unlink', $pics);
        }
    }
}
