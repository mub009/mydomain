<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\BusinessCard;
use App\Models\Category;
use App\Models\User;
use App\Support\Cards\CardEngine;
use App\Support\Cards\ImageCard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
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

    public function test_the_location_link_opens_the_business_on_google_maps(): void
    {
        $this->business->refresh();
        // Name and address, so Maps shows the business — not a bare pin at its coordinates.
        $this->assertSame(
            'https://www.google.com/maps/search/?api=1&query=Spice%20Garden%2C%201%20Main%20St%2C%20Kochi%2C%20KL',
            CardEngine::mapsUrl($this->business, '1 Main St, Kochi, KL'),
        );
        // With a Google Place ID, that exact place.
        $this->business->googlePlaceId = 'ChIJabc123';
        $this->assertSame(
            'https://www.google.com/maps/search/?api=1&query=Spice%20Garden%2C%201%20Main%20St%2C%20Kochi%2C%20KL&query_place_id=ChIJabc123',
            CardEngine::mapsUrl($this->business, '1 Main St, Kochi, KL'),
        );
        // No address: the coordinates.
        $this->business->googlePlaceId = null;
        $this->assertSame('https://www.google.com/maps/search/?api=1&query=9.9%2C76.2', CardEngine::mapsUrl($this->business, null));
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
        // The dealer's preview looks the same.
        $dealerHtml = $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)->json('data.imagePreviewHtml');
        $this->assertStringNotContainsString($outline, $dealerHtml);
        $this->assertStringNotContainsString('aria-label="Instagram"', $dealerHtml);
    }

    public function test_the_business_owner_uploads_a_picture_into_a_free_image_spot(): void
    {
        $this->withoutVite();
        $this->imageTemplate($this->admin(), ['hotspots' => [$this->spot('call'), $this->spot('custom_image', ['label' => 'Shop photo'])]]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $this->ownerEmail, 'password' => 'Password123!'])->json('data.accessToken');
        $owner = ['Authorization' => "Bearer {$token}"];
        $url = "/api/v1/businesses/{$this->business->id}/card";

        // The empty free image is listed as missing, with an upload box.
        $this->getJson($url, $owner)->assertJsonPath('data.missingDetails', [
            ['key' => 'custom_image', 'spot' => 'h-custom_image', 'label' => 'Shop photo', 'section' => 'Visiting Card'],
        ]);
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))->assertOk()
            ->assertSee('data-via="spot"  data-spot="h-custom_image"', false)->assertSee('data-upload-field="card-images"', false)
            // Details already filled are listed too, with their value, to update.
            ->assertSee('Card details')->assertSee('value="98765 43210"', false);

        // Only that kind of spot, and only a safe picture.
        $this->putJson($url, ['spotImage' => ['id' => 'h-call', 'url' => 'https://cdn.example.test/p.jpg']], $owner)->assertStatus(400);
        $this->putJson($url, ['spotImage' => ['id' => 'h-custom_image', 'url' => 'https://cdn.example.test/cards/images/shop.jpg']], $owner)->assertOk();

        // The card gets its own copy of the design, with the picture in it.
        $card = BusinessCard::where('businessId', $this->business->id)->first();
        $this->assertSame('https://cdn.example.test/cards/images/template.jpg', $card->imageUrl);
        $this->assertSame('https://cdn.example.test/cards/images/shop.jpg', collect($card->hotspots)->firstWhere('id', 'h-custom_image')['value']);
        $this->getJson($url, $owner)->assertJsonPath('data.missingDetails', [])
            ->assertJsonPath('data.cardDetails.0.missing', false);
        $this->assertStringContainsString('cards/images/shop.jpg', $this->getJson($url, $owner)->json('data.imagePreviewHtml'));
        // Still listed, to change the picture.
        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))->assertOk()
            ->assertSee('data-spot="h-custom_image"', false)->assertSee('value="https://cdn.example.test/cards/images/shop.jpg"', false);
    }

    public function test_the_category_and_city_detail_is_picked_from_drop_downs(): void
    {
        $this->withoutVite();
        Category::create(['name' => 'Bakeries', 'slug' => 'bakeries']);
        $this->imageTemplate($this->admin(), ['hotspots' => [$this->spot('call'), $this->spot('tagline', ['y' => 80])]]);
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))->assertOk()
            ->assertSee('Category &amp; city', false)->assertSee('Restaurants · Kochi')
            ->assertSee('<select id="card-detail-tagline" name="categoryId"', false)
            ->assertSee('Bakeries')
            ->assertSee('name="state"', false)->assertSee('name="city"', false)
            ->assertSee('data-state="KL" data-city="Kochi"', false);
    }

    public function test_the_google_review_detail_has_google_maps_options(): void
    {
        $this->withoutVite();
        $this->business->update(['googlePlaceId' => 'ChIJsaved123']);
        $this->save([$this->spot('call'), $this->spot('google_review', ['y' => 80])])->assertOk();
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $url = "/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card');

        // Without Google search set up: a link to the business on Google Maps, to copy its share link.
        config(['services.google_places.key' => null]);
        $this->get($url)->assertOk()
            ->assertSee('Google review link')
            ->assertSee('https://www.google.com/maps/search/?api=1&amp;query=Spice%20Garden%20Kochi', false)
            ->assertSee('name="googlePlaceId" value="ChIJsaved123" data-initial="ChIJsaved123"', false)
            ->assertSee('name="googleReviewUrl"', false)
            ->assertDontSee('data-places-search', false);

        // With it: "Find your business on Google Maps", filled in for Save.
        config(['services.google_places.key' => 'test-key']);
        $this->get($url)->assertOk()
            ->assertSee('Find your business on Google Maps')
            ->assertSee('data-places-search data-places-fill', false)
            ->assertSee('value="Spice Garden Kochi"', false);
    }

    public function test_open_card_shows_the_colour_bar_without_being_signed_in_there(): void
    {
        $this->withoutVite();
        $this->save([$this->spot('call')])->assertOk();
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();

        // The dashboard's "Open card" carries the owner pass.
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $html = $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))->assertOk()->getContent();
        $this->assertMatchesRegularExpression('~href="https://markkito.test/card/spice-garden\?owner=([A-Za-z0-9_.-]+)"[^>]*data-open-card~', $html);
        preg_match('~/card/spice-garden\?owner=([A-Za-z0-9_.-]+)"~', $html, $m);
        $pass = $m[1];
        $this->assertStringNotContainsString('data-card-colour', $html);

        // Opened in a browser that isn't signed in on the card's address: the bar still shows, never cached.
        $this->post('/logout');
        $page = $this->get("/card/spice-garden?owner={$pass}")->assertOk()->assertSee('id="mk-owner-bar"', false);
        $this->assertStringContainsString('no-store', $page->headers->get('Cache-Control'));
        preg_match('~body.owner = "([^"]+)"~', $page->getContent(), $t);
        // Without the pass, or with a forged one: just the card.
        $this->assertStringNotContainsString('mk-owner-bar', $this->get('/card/spice-garden')->getContent());
        $this->assertStringNotContainsString('mk-owner-bar', $this->get('/card/spice-garden?owner='.substr($pass, 0, -2).'00')->getContent());

        // The bar saves the colour with the page's pass — and only the colour or design.
        $this->postJson('/api/v1/cards/spice-garden/owner', ['owner' => $t[1], 'imageColour' => ['tint' => '#7c3aed', 'strength' => 60]])->assertOk();
        $this->assertSame('#7c3aed', BusinessCard::where('businessId', $this->business->id)->first()->imageColour['tint']);
        $this->postJson('/api/v1/cards/spice-garden/owner', ['owner' => 'bad.'.str_repeat('0', 64), 'imageColour' => null])->assertStatus(403);
        $this->postJson('/api/v1/cards/spice-garden/owner', ['owner' => $t[1], 'isPublished' => false])->assertStatus(422);

        // A pass is for its own business only.
        $other = Business::create([
            'ownerId' => $this->business->ownerId, 'name' => 'Other', 'slug' => 'other-shop', 'categoryId' => $this->business->categoryId,
            'status' => 'PUBLISHED', 'phone' => '98765 43210', 'addressLine1' => 'x', 'city' => 'Kochi', 'state' => 'KL', 'latitude' => 9.9, 'longitude' => 76.2,
        ]);
        $this->assertNull(CardEngine::ownerFromToken($pass, $other));
        $this->assertNotNull(CardEngine::ownerFromToken($pass, $this->business));
    }

    public function test_pictures_are_moved_and_zoomed_from_the_open_card(): void
    {
        $this->withoutVite();
        $this->business->update(['logoUrl' => 'https://cdn.example.test/logos/logo.png']);
        $this->save([$this->spot('call'), $this->spot('logo', ['y' => 10, 'w' => 40, 'h' => 20])])->assertOk();
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();

        // The open card marks the logo box to arrange, and the bar offers it.
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $html = $this->get('/card/spice-garden')->assertOk()->getContent();
        $this->assertStringContainsString('data-arrange="h-logo" data-arrange-kind="logo" data-arrange-shape="" data-arrange-size="100" data-arrange-label="Logo"', $html);
        $this->assertStringContainsString('Arrange pictures', $html);
        $this->assertStringContainsString('aria-label="Zoom in"', $html);
        preg_match('~body.owner = "([^"]+)"~', $html, $t);

        // Saved with the bar's pass: zoomed in and moved, drawn so on the card.
        $fit = ['l' => -20, 't' => -10, 'w' => 150, 'h' => 150];
        $this->postJson('/api/v1/cards/spice-garden/owner', ['owner' => $t[1], 'spotFit' => ['id' => 'h-logo', 'fit' => $fit]])->assertOk();
        $logo = collect(BusinessCard::where('businessId', $this->business->id)->first()->hotspots)->firstWhere('id', 'h-logo');
        $this->assertEquals($fit, $logo['fit']);
        $this->assertStringContainsString('left:-20%;top:-10%;width:150%;height:150%', $this->get('/card/spice-garden')->getContent());

        // Kept inside the rules: never past its edges, and only picture boxes.
        $this->postJson('/api/v1/cards/spice-garden/owner', ['owner' => $t[1], 'spotFit' => ['id' => 'h-logo', 'fit' => ['l' => -90, 't' => 0, 'w' => 150, 'h' => 150]]])->assertOk();
        $this->assertEquals(-50, collect(BusinessCard::where('businessId', $this->business->id)->first()->hotspots)->firstWhere('id', 'h-logo')['fit']['l']);
        $this->postJson('/api/v1/cards/spice-garden/owner', ['owner' => $t[1], 'spotFit' => ['id' => 'h-call', 'fit' => $fit]])->assertStatus(400);

        // Reset: back as it was.
        $this->postJson('/api/v1/cards/spice-garden/owner', ['owner' => $t[1], 'spotFit' => ['id' => 'h-logo', 'fit' => null]])->assertOk();
        $this->assertNull(collect(BusinessCard::where('businessId', $this->business->id)->first()->hotspots)->firstWhere('id', 'h-logo')['fit'] ?? null);
    }

    public function test_the_business_team_colours_only_the_areas_the_admin_marked(): void
    {
        $this->save([$this->spot('call')])->assertOk();
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $square = [[0, 0], [50, 0], [50, 50], [0, 50]];
        // The admin marks where the colour may go.
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['imageColour' => ['tint' => '#16a34a', 'strength' => 60, 'areas' => [['points' => $square]]]], $this->admin())->assertOk();
        $areas = fn () => BusinessCard::where('businessId', $this->business->id)->first()->imageColour['areas'] ?? null;

        // The business team, from the open card's bar.
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        preg_match('~body.owner = "([^"]+)"~', $this->get('/card/spice-garden')->getContent(), $t);
        $pick = fn ($colour) => $this->postJson('/api/v1/cards/spice-garden/owner', ['owner' => $t[1], 'imageColour' => $colour])->assertOk();

        // A colour: only inside the marked area — even if other areas are sent.
        $pick(['tint' => '#2563eb', 'strength' => 60, 'areas' => [['points' => [[0, 0], [100, 0], [100, 100]]]]]);
        $this->assertSame([['erase' => false, 'points' => $square]], $areas());
        $html = $this->get('/card/spice-garden')->getContent();
        $this->assertStringContainsString('class="colour-areas"', $html);

        // "Original": the card shows no colour, but the marked area is kept…
        $pick(null);
        $this->assertSame([['erase' => false, 'points' => $square]], $areas());
        $html = $this->get('/card/spice-garden')->getContent();
        $this->assertStringNotContainsString('class="colour-areas"', $html);
        $this->assertStringNotContainsString('feColorMatrix', $html);
        $this->assertMatchesRegularExpression('~title="Original" aria-label="Original" aria-checked="true"~', $html);

        // …so the next colour still goes only there, never over the whole card.
        $pick(['tint' => '#dc2626', 'strength' => 60]);
        $this->assertSame([['erase' => false, 'points' => $square]], $areas());
        $this->assertStringContainsString('class="colour-areas"', $this->get('/card/spice-garden')->getContent());
    }

    public function test_only_admins_mark_the_colour_areas_in_the_visiting_card_section(): void
    {
        $this->withoutVite();
        $this->save([$this->spot('call')])->assertOk();
        $url = "/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card');

        // The business team and the dealer: no area tools.
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $this->get($url)->assertOk()->assertDontSee('data-colour-areas', false);
        $this->post('/logout');
        $this->post('/login', ['email' => $this->dealerEmail, 'password' => 'Password123!']);
        $this->get($url)->assertOk()->assertDontSee('data-colour-areas', false);
        $this->post('/logout');

        // The admin: "Mark areas".
        $admin = User::create([
            'email' => 'admin-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'A', 'lastName' => 'D', 'status' => 'ACTIVE', 'role' => 'ADMIN',
        ]);
        $this->post('/login', ['email' => $admin->email, 'password' => 'Password123!']);
        $this->get($url)->assertOk()->assertSee('data-colour-areas', false)->assertSee('id="colour-areas"', false)->assertSee('Mark areas')->assertSee('Nothing marked');

        // Areas saved with no colour picked yet are kept (what the editor sends), and shown.
        $token = $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => 'Password123!'])->json('data.accessToken');
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['imageColour' => ['areas' => [['points' => [[0, 0], [50, 0], [50, 50]]]]]], ['Authorization' => "Bearer {$token}"])
            ->assertOk()->assertJsonCount(1, 'data.imageColour.areas');
        $this->get($url)->assertOk()->assertSee('1 area marked')->assertSee('Change areas')->assertSee('Clear areas');
        // No colour yet: the card looks as it was.
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $this->assertStringNotContainsString('feColorMatrix', $this->get('/card/spice-garden')->getContent());

        // On the open card, the admin's bar links straight to the area editor; the business team's doesn't.
        $this->get('/card/spice-garden')->assertOk()->assertSee('Colour areas →')->assertSee('section=Visiting+Card&amp;areas=1#colour-areas', false);
        $this->post('/logout');
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $this->get('/card/spice-garden')->assertOk()->assertSee('id="mk-owner-bar"', false)->assertDontSee('Colour areas →');
    }

    public function test_the_admin_sees_colour_areas_even_before_the_card_has_a_picture_design(): void
    {
        $this->withoutVite();
        $admin = User::create([
            'email' => 'admin-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'A', 'lastName' => 'D', 'status' => 'ACTIVE', 'role' => 'ADMIN',
        ]);
        $this->post('/login', ['email' => $admin->email, 'password' => 'Password123!']);
        $html = $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))->assertOk()->getContent();
        $this->assertStringContainsString('data-colour-areas', $html);
        $this->assertStringContainsString('no picture design yet', $html);
        $this->assertMatchesRegularExpression('~data-areas-edit\s+disabled~', $html);
    }

    public function test_colour_areas_marked_on_a_design_apply_to_every_card_wearing_it(): void
    {
        $admin = $this->admin();
        $id = $this->imageTemplate($admin);
        $top = [[0, 0], [100, 0], [100, 40], [0, 40]];

        // Marked in the template editor, saved and checked with the template.
        $this->patchJson("/api/v1/admin/card-templates/{$id}", ['colourAreas' => [['points' => $top], ['erase' => true, 'points' => [[120, 0], [5, 5], [5, 10]]]]], $admin)
            ->assertOk()->assertJsonCount(2, 'data.colourAreas')->assertJsonPath('data.colourAreas.1.points.0', [100, 0]);
        $this->getJson("/api/v1/admin/card-templates/{$id}", $admin)->assertJsonCount(2, 'data.colourAreas');

        // The business wears it and picks a colour from the open card: only the design's areas change.
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        preg_match('~body.owner = "([^"]+)"~', $this->get('/card/spice-garden')->getContent(), $t);
        $this->postJson('/api/v1/cards/spice-garden/owner', ['owner' => $t[1], 'imageColour' => ['tint' => '#2563eb', 'strength' => 60]])->assertOk();
        $this->assertSame([], BusinessCard::where('businessId', $this->business->id)->first()->imageColour['areas']);
        $html = $this->get('/card/spice-garden')->getContent();
        $this->assertStringContainsString('class="colour-areas"', $html);
        $this->assertSame(2, count(ImageCard::source($this->business->fresh())['colour']['areas']));
        // The dashboard says the design's areas are used.
        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))->assertOk();
        $this->getJson("/api/v1/businesses/{$this->business->id}/card", $this->auth)->assertJsonPath('data.designColourAreas', 2);

        // A card's own areas win over the design's.
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['imageColour' => ['tint' => '#2563eb', 'strength' => 60, 'areas' => [['points' => [[0, 50], [50, 50], [50, 100]]]]]], $admin)->assertOk();
        $this->assertEquals([[0, 50], [50, 50], [50, 100]], ImageCard::source($this->business->fresh())['colour']['areas'][0]['points']);

        // Removing the design's image removes its areas too.
        $this->patchJson("/api/v1/admin/card-templates/{$id}", ['imageUrl' => null], $admin)->assertOk()->assertJsonPath('data.colourAreas', []);
        // Only admins edit templates.
        $this->patchJson("/api/v1/admin/card-templates/{$id}", ['colourAreas' => []], $this->auth)->assertStatus(403);
    }

    public function test_the_dealer_changes_and_zooms_a_free_image_from_the_open_card(): void
    {
        Storage::fake('spaces', ['url' => 'https://cdn.example.test']);
        $this->save([$this->spot('call'), $this->spot('custom_image', ['label' => 'Shop photo', 'value' => 'https://cdn.example.test/cards/images/old.jpg', 'fit' => ['l' => -10, 't' => 0, 'w' => 140, 'h' => 140]])])->assertOk();
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();

        // The dealer's open card: the free image can be arranged and its picture changed.
        $this->post('/login', ['email' => $this->dealerEmail, 'password' => 'Password123!']);
        $html = $this->get('/card/spice-garden')->assertOk()->getContent();
        $this->assertStringContainsString('data-arrange="h-custom_image" data-arrange-kind="custom_image"', $html);
        $this->assertStringContainsString('data-arrange-change', $html);
        preg_match('~body.owner = "([^"]+)"~', $html, $t);

        // A new picture, uploaded with the page's pass, goes into that box — centred again.
        $img = imagecreatetruecolor(400, 300);
        ob_start();
        imagejpeg($img);
        $file = UploadedFile::fake()->createWithContent('shop.jpg', ob_get_clean());
        $this->post('/api/v1/cards/spice-garden/owner/picture', ['owner' => $t[1], 'spotId' => 'h-custom_image', 'file' => $file], ['Accept' => 'application/json'])->assertOk();
        $spot = collect(BusinessCard::where('businessId', $this->business->id)->first()->hotspots)->firstWhere('id', 'h-custom_image');
        $this->assertStringContainsString('/cards/images/', $spot['value']);
        $this->assertStringNotContainsString('old.jpg', $spot['value']);
        // Full size: the 400×300 picture fills its 180×80 px box — full width, taller than the box, centred.
        $this->assertEquals(['l' => 0, 't' => -34.38, 'w' => 100, 'h' => 168.75], $spot['fit']);
        Storage::disk('spaces')->assertExists('cards/images/'.basename($spot['value']));
        $this->get('/card/spice-garden')->assertSee('left:0%;top:-34.38%;width:100%;height:168.75%', false);

        // Then zoomed in, as the bar's Save sends it.
        $this->postJson('/api/v1/cards/spice-garden/owner', ['owner' => $t[1], 'spotFit' => ['id' => 'h-custom_image', 'fit' => ['l' => -25, 't' => -25, 'w' => 150, 'h' => 150]]])->assertOk();
        $this->assertEquals(150, collect(BusinessCard::where('businessId', $this->business->id)->first()->hotspots)->firstWhere('id', 'h-custom_image')['fit']['w']);

        // Only a free-image box takes a picture this way, and only with a real pass.
        $again = UploadedFile::fake()->createWithContent('x.jpg', file_get_contents($file->getRealPath()));
        $this->post('/api/v1/cards/spice-garden/owner/picture', ['owner' => $t[1], 'spotId' => 'h-call', 'file' => $again], ['Accept' => 'application/json'])->assertStatus(400);
        $this->post('/logout');
        $this->post('/api/v1/cards/spice-garden/owner/picture', ['owner' => 'bad.'.str_repeat('0', 64), 'spotId' => 'h-custom_image', 'file' => $again], ['Accept' => 'application/json'])->assertStatus(403);
    }

    public function test_an_uploaded_free_image_starts_filling_its_whole_box(): void
    {
        // A wide picture in a tall box: full height, wider than the box, centred.
        $this->assertEquals(['l' => -50, 't' => 0, 'w' => 200, 'h' => 100], ImageCard::coverFit(['w' => 50, 'h' => 50], 100, 100, 400, 200));
        // A tall picture in a wide box: full width, taller than the box, centred.
        $this->assertEquals(['l' => 0, 't' => -150, 'w' => 100, 'h' => 400], ImageCard::coverFit(['w' => 50, 'h' => 25], 100, 100, 100, 200));
        // Same shape: exactly the box. Unknown sizes: nothing.
        $this->assertEquals(['l' => 0, 't' => 0, 'w' => 100, 'h' => 100], ImageCard::coverFit(['w' => 40, 'h' => 20], 1000, 1000, 200, 100));
        $this->assertNull(ImageCard::coverFit(['w' => 40, 'h' => 20], null, null, 200, 100));

        // From the dashboard (Card details): the picture's size goes with it, and it fills the box too.
        $this->save([$this->spot('call'), $this->spot('custom_image', ['w' => 50, 'h' => 30])])->assertOk();
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['spotImage' => ['id' => 'h-custom_image', 'url' => 'https://cdn.example.test/cards/images/p.jpg', 'width' => 300, 'height' => 300]], $this->auth)->assertOk();
        // The box is 300×300 px (50% of 600, 30% of 1000): a square picture fills it exactly.
        $this->assertEquals(['l' => 0, 't' => 0, 'w' => 100, 'h' => 100], collect(BusinessCard::where('businessId', $this->business->id)->first()->hotspots)->firstWhere('id', 'h-custom_image')['fit']);
        // Without a size, it starts centred as before.
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['spotImage' => ['id' => 'h-custom_image', 'url' => 'https://cdn.example.test/cards/images/q.jpg']], $this->auth)->assertOk();
        $this->assertNull(collect(BusinessCard::where('businessId', $this->business->id)->first()->hotspots)->firstWhere('id', 'h-custom_image')['fit'] ?? null);
    }

    public function test_free_images_auto_fit_their_box_and_logos_stay_whole(): void
    {
        $this->business->update(['logoUrl' => 'https://cdn.example.test/logos/logo.png']);
        $this->save([
            $this->spot('logo', ['y' => 5]),
            $this->spot('custom_image', ['y' => 40, 'value' => 'https://cdn.example.test/cards/images/old-photo.jpg']),
        ])->assertOk();
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $html = $this->get('/card/spice-garden')->assertOk()->getContent();
        // A free image never arranged fills its whole box…
        $this->assertStringContainsString('<img src="https://cdn.example.test/cards/images/old-photo.jpg" alt="" style="object-fit:cover"', $html);
        // …while the logo is shown whole, never cropped.
        $this->assertMatchesRegularExpression('~<img src="https://cdn.example.test/logos/logo.png" alt="[^"]*" />~', $html);
        // The bar's "Auto fit" puts an arranged picture back to filling its box.
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $this->get('/card/spice-garden')->assertSee('data-arrange-reset>Auto fit</button>', false);
    }

    public function test_the_dealer_shapes_a_free_image_from_the_open_card(): void
    {
        // A 180×80 px box (30% × 8% of the 600×1000 card).
        $this->save([$this->spot('logo', ['y' => 5]), $this->spot('custom_image', ['y' => 40, 'radius' => 20, 'value' => 'https://cdn.example.test/cards/images/p.jpg'])])->assertOk();
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $this->post('/login', ['email' => $this->dealerEmail, 'password' => 'Password123!']);
        $html = $this->get('/card/spice-garden')->getContent();
        $this->assertStringContainsString('data-shape-preset="round"', $html);
        preg_match('~body.owner = "([^"]+)"~', $html, $t);
        $shapeOf = fn () => collect(BusinessCard::where('businessId', $this->business->id)->first()->hotspots)->firstWhere('id', 'h-custom_image');
        $pick = fn ($shape, $id = 'h-custom_image') => $this->postJson('/api/v1/cards/spice-garden/owner', ['owner' => $t[1], 'spotShape' => ['id' => $id, 'shape' => $shape]]);

        // Square: the biggest square that fits the wide box, centred — its rounded corners dropped.
        $pick('square')->assertOk();
        $this->assertEquals([[27.8, 0], [72.2, 0], [72.2, 100], [27.8, 100]], $shapeOf()['shape']);
        $this->assertNull($shapeOf()['radius']);
        $this->assertStringContainsString('clip-path:polygon(27.8% 0%,72.2% 0%,72.2% 100%,27.8% 100%)', $this->get('/card/spice-garden')->getContent());

        // Round: a circle as tall as the box; Oval: fills the box.
        $pick('round')->assertOk();
        $round = $shapeOf()['shape'];
        $this->assertCount(64, $round);
        $this->assertEquals([72.2, 50], $round[0]);
        $this->assertEquals([50, 100], $round[16]);
        $pick('oval')->assertOk();
        $this->assertEquals([100, 50], $shapeOf()['shape'][0]);
        $this->assertEquals([50, 100], $shapeOf()['shape'][16]);

        // Its size: at 50% the oval is half as big, centred, and the size is remembered for the bar.
        $this->postJson('/api/v1/cards/spice-garden/owner', ['owner' => $t[1], 'spotShape' => ['id' => 'h-custom_image', 'shape' => 'round', 'size' => 50]])->assertOk();
        $this->assertEquals([61.1, 50], $shapeOf()['shape'][0]);
        $this->assertEquals([50, 75], $shapeOf()['shape'][16]);
        $this->assertSame(['round', 50], [$shapeOf()['shapePreset'], $shapeOf()['shapeSize']]);
        $this->assertStringContainsString('data-arrange-shape="round" data-arrange-size="50"', $this->get('/card/spice-garden')->getContent());
        $this->assertStringContainsString('data-shape-size="-10"', $this->get('/card/spice-garden')->getContent());
        $this->postJson('/api/v1/cards/spice-garden/owner', ['owner' => $t[1], 'spotShape' => ['id' => 'h-custom_image', 'shape' => 'round', 'size' => 5]])->assertStatus(400);

        // Normal: no shape at all.
        $pick('normal')->assertOk();
        $this->assertNull($shapeOf()['shape']);
        $this->assertSame([null, null], [$shapeOf()['shapePreset'], $shapeOf()['shapeSize']]);

        // Only free images, and only the ready shapes.
        $pick('round', 'h-logo')->assertStatus(400);
        $pick('star')->assertStatus(400);
    }

    public function test_changing_the_design_carries_the_old_designs_pictures_and_values_over(): void
    {
        $admin = $this->admin();
        $template = fn (string $name, array $spots, string $img) => $this->postJson('/api/v1/admin/card-templates', [
            'name' => $name, 'layout' => 'classic', 'categoryId' => $this->business->categoryId,
            'imageUrl' => "https://cdn.example.test/cards/images/{$img}.jpg", 'imageWidth' => 600, 'imageHeight' => 1000, 'hotspots' => $spots,
        ], $admin)->assertCreated()->json('data.id');
        $first = $template('First', [
            $this->spot('call'),
            ['id' => 'a-photo', 'action' => 'custom_image', 'label' => 'Shop photo', 'x' => 10, 'y' => 30, 'w' => 80, 'h' => 20],
            ['id' => 'a-link', 'action' => 'instagram', 'label' => 'Insta', 'x' => 10, 'y' => 60, 'w' => 40, 'h' => 6],
        ], 'first');
        $second = $template('Second', [
            $this->spot('whatsapp'),
            // Differently placed boxes of the same kinds, matched by name and kind.
            ['id' => 'b-photo', 'action' => 'custom_image', 'label' => 'Shop photo', 'x' => 20, 'y' => 10, 'w' => 60, 'h' => 30],
            ['id' => 'b-link', 'action' => 'instagram', 'label' => 'Insta', 'x' => 10, 'y' => 80, 'w' => 40, 'h' => 6],
            // A box the new design fills itself keeps its own.
            ['id' => 'b-text', 'action' => 'custom_text', 'value' => 'Since 1998', 'x' => 10, 'y' => 90, 'w' => 80, 'h' => 5],
        ], 'second');
        $url = "/api/v1/businesses/{$this->business->id}/card";

        // On the first design: a picture cut round, and its own Instagram.
        $this->putJson($url, ['templateId' => $first], $this->auth)->assertOk();
        $this->putJson($url, ['spotImage' => ['id' => 'a-photo', 'url' => 'https://cdn.example.test/cards/images/shop.jpg']], $this->auth)->assertOk();
        $this->putJson($url, ['spotShape' => ['id' => 'a-photo', 'shape' => 'round']], $this->auth)->assertOk();
        $card = BusinessCard::where('businessId', $this->business->id)->first();
        $card->update(['hotspots' => collect($card->hotspots)->map(fn ($h) => $h['id'] === 'a-link' ? [...$h, 'value' => '@spiceshop'] : $h)->all()]);
        // Still the first design as made: ticked.
        $this->getJson($url, $this->auth)->assertJsonPath('data.imageTemplates.0.inUse', true);

        // Switching to the second design takes them along.
        $this->putJson($url, ['templateId' => $second], $this->auth)->assertOk();
        $card = BusinessCard::where('businessId', $this->business->id)->first();
        $spots = collect($card->hotspots)->keyBy('id');
        $this->assertSame('https://cdn.example.test/cards/images/second.jpg', $card->imageUrl);
        $this->assertSame('https://cdn.example.test/cards/images/shop.jpg', $spots['b-photo']['value']);
        $this->assertNull($spots['b-photo']['fit'] ?? null); // fits its new box
        $this->assertNull($spots['b-photo']['shape'] ?? null); // the new design's own shape
        $this->assertSame('@spiceshop', $spots['b-link']['value']);
        $this->assertSame('Since 1998', $spots['b-text']['value']);
        $this->assertEquals([20, 10, 60, 30], [$spots['b-photo']['x'], $spots['b-photo']['y'], $spots['b-photo']['w'], $spots['b-photo']['h']]);
        // The second design is the one ticked.
        $in = collect($this->getJson($url, $this->auth)->json('data.imageTemplates'))->firstWhere('inUse', true);
        $this->assertSame($second, $in['id']);

        // And back again: the picture comes with it.
        $this->putJson($url, ['templateId' => $first], $this->auth)->assertOk();
        $this->assertSame('https://cdn.example.test/cards/images/shop.jpg', collect(BusinessCard::where('businessId', $this->business->id)->first()->hotspots)->firstWhere('id', 'a-photo')['value']);

        // Re-picking the design already worn resets it to the design as made.
        $this->putJson($url, ['templateId' => $first], $this->auth)->assertOk()->assertJsonPath('data.imageUrl', null);
    }

    public function test_the_card_details_have_one_save_button_for_all(): void
    {
        $this->withoutVite();
        $this->save([$this->spot('call'), $this->spot('tagline', ['y' => 40]), $this->spot('email', ['y' => 80]), $this->spot('instagram', ['y' => 90])])->assertOk();
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $html = $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))->assertOk()->getContent();
        $this->assertSame(1, substr_count($html, 'data-card-details-form'));
        $this->assertSame(1, substr_count($html, 'data-card-details-save'));
        $this->assertSame(4, substr_count($html, 'data-detail '));
        $this->assertStringNotContainsString('data-missing-save', $html);
    }

    public function test_a_logo_box_shows_the_business_photo_when_it_has_no_logo(): void
    {
        $this->save([$this->spot('logo')])->assertOk();
        $url = "/api/v1/businesses/{$this->business->id}/card";
        // No logo and no photo: nothing to show, and the card says so.
        $this->getJson($url, $this->auth)->assertJsonPath('data.missingDetails.0.key', 'logo');

        $this->business->photos()->create(['url' => 'https://cdn.example.test/photos/shop.jpg', 'sortOrder' => 0]);
        $this->getJson($url, $this->auth)->assertJsonPath('data.missingDetails', []);
        $this->assertStringContainsString('https://cdn.example.test/photos/shop.jpg', $this->getJson($url, $this->auth)->json('data.imagePreviewHtml'));

        // A logo still comes first.
        $this->business->update(['logoUrl' => 'https://cdn.example.test/logos/logo.png']);
        $html = $this->getJson($url, $this->auth)->json('data.imagePreviewHtml');
        $this->assertStringContainsString('logos/logo.png', $html);
        $this->assertStringNotContainsString('photos/shop.jpg', $html);
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
        // No colour panel on the dashboard: the colour is changed on the card page (the owner bar).
        $page->assertDontSee('Card design & actions', false)->assertDontSee('data-colour-panel', false)->assertSee('press Open card');
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
            ->assertOk()->assertSee('cards/images/template.jpg', false)->assertDontSee('data-colour-panel', false);
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
            ->assertSee('query=Spice%20Garden%2C%201%20Main%20St', false);

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
        // Every preview shows the saved colour (it is changed on the card page, not over the preview).
        $this->assertStringContainsString('feColorMatrix', $this->getJson($url, $owner)->json('data.imagePreviewHtml'));
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

        // The owner's Visiting Card page points to the card page for the colour.
        $this->withoutVite();
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))->assertOk()
            ->assertDontSee('data-colour-panel', false)->assertSee('press Open card')->assertSee('?owner=', false);

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
        $this->assertMatchesRegularExpression('#<a class="spot detail"[^>]*href="https://www.google.com/maps/search/\?api=1&amp;query=Spice%20Garden%2C%201%20Main%20St%2C%20Kochi%2C%20KL"[^>]*><span>1 Main St, Kochi, KL</span>#', $html);
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
        $this->assertStringContainsString('height:8%;border-radius:50%"', $html);
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
        $this->assertStringContainsString('width:90%;height:12%;border-radius:0"', $html);
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

        // No position = centred and covering; zoomed out smaller than the area, it stays within it;
        // free images and the logo keep it (the logo is arranged from the open card), nothing else.
        $this->save([$this->spot('custom_image', $area)])->assertOk()->assertJsonPath('data.hotspots.0.fit', null);
        $this->assertStringContainsString('<img src="https://cdn.example.test/cards/images/shop.jpg" alt="" style="object-fit:cover"', $this->get('/card/spice-garden')->getContent());
        $this->save([$this->spot('custom_image', $area + ['fit' => ['l' => 50, 't' => 0, 'w' => 60, 'h' => 100]])])
            ->assertOk()->assertJsonPath('data.hotspots.0.fit', ['l' => 40, 't' => 0, 'w' => 60, 'h' => 100]);
        $this->save([$this->spot('custom_image', $area + ['fit' => ['l' => 0, 't' => 0, 'w' => 5, 'h' => 100]])])->assertStatus(400);
        $this->save([$this->spot('logo', $area + ['fit' => $fit])])->assertOk()->assertJsonPath('data.hotspots.0.fit', $fit);
        $this->save([$this->spot('qr', $area + ['fit' => $fit])])->assertOk()->assertJsonPath('data.hotspots.0.fit', null);
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
        $this->assertStringContainsString('query=Spice%20Garden%2C%201%20Main%20St', $html);
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
            ->assertSee("api\\/v1\\/cards\\/spice-garden\\/owner", false)
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

    public function test_the_owner_changes_the_card_design_from_the_public_card_link(): void
    {
        $admin = $this->admin();
        $first = $this->imageTemplate($admin);
        $second = $this->postJson('/api/v1/admin/card-templates', [
            'name' => 'Blue Image Card', 'layout' => 'classic', 'categoryId' => $this->business->categoryId,
            'imageUrl' => 'https://cdn.example.test/cards/images/blue.jpg', 'imageWidth' => 600, 'imageHeight' => 1000,
            'hotspots' => [$this->spot('call')],
        ], $admin)->assertCreated()->json('data.id');
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();

        // The owner's bar lists the category's designs, the one in use marked.
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $html = $this->get('/card/spice-garden')->assertOk()->getContent();
        $this->assertStringContainsString('aria-label="Card design"', $html);
        $this->assertMatchesRegularExpression('~aria-checked="true" data-design="'.$first.'"~', $html);
        $this->assertMatchesRegularExpression('~aria-checked="false" data-design="'.$second.'"~', $html);
        $this->assertStringContainsString('cards/images/blue.jpg', $html);

        // Picking one (what the bar sends) puts it on the card.
        $token = $this->postJson('/api/v1/auth/login', ['email' => $this->ownerEmail, 'password' => 'Password123!'])->json('data.accessToken');
        $this->putJson("/api/v1/businesses/{$this->business->id}/card", ['templateId' => $second], ['Authorization' => "Bearer {$token}"])->assertOk();
        $html = $this->get('/card/spice-garden')->assertOk()->getContent();
        $this->assertMatchesRegularExpression('~aria-checked="true" data-design="'.$second.'"~', $html);
    }

    public function test_missing_card_details_get_a_textbox_on_the_visiting_card_section(): void
    {
        $this->save([$this->spot('instagram'), $this->spot('logo'), $this->spot('whatsapp')])->assertOk();
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))->assertOk()
            ->assertSee('data-via="links"', false)
            ->assertSee('name="instagramUsername"', false)
            // The logo is uploaded right here too; only opening hours link to their section.
            ->assertSee('data-upload-field="business-logo"', false)->assertSee('name="logoUrl"', false)
            ->assertDontSee('Add in Contact', false);

        $this->business->update(['description' => null]);
        $this->save([$this->spot('hours'), $this->spot('about')])->assertOk();
        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))->assertOk()
            ->assertSee('<textarea id="card-detail-about" name="description"', false)
            ->assertSee('Add in Hours', false);
    }

    public function test_a_card_made_from_a_huge_photo_downloads_as_a_pdf_within_the_live_memory_limit(): void
    {
        // A 48-megapixel photo (a recent phone's full resolution): a small file,
        // but about 190MB once opened at full size — what used to run the
        // live server's 256MB out on "Download PDF".
        // The live server's limit, set first (PHP won't lower it below what's
        // already in use), and the photo built as a palette image (1 byte a pixel) to stay under it here.
        $this->assertNotFalse(ini_set('memory_limit', '256M'));
        $img = imagecreate(6000, 8000);
        for ($y = 0; $y < 8000; $y += 100) {
            imagefilledrectangle($img, 0, $y, 5999, $y + 99, imagecolorallocate($img, (int) ($y / 32) % 256, 120, 200));
        }
        ob_start();
        imagejpeg($img, null, 80);
        $photo = (string) ob_get_clean();
        unset($img);
        Http::fake(['markkito.test/huge/*' => Http::response($photo, 200, ['Content-Type' => 'image/jpeg'])]);
        BusinessCard::updateOrCreate(['businessId' => $this->business->id], [
            'imageUrl' => 'https://markkito.test/huge/card.jpg', 'imageWidth' => 6000, 'imageHeight' => 8000, 'isPublished' => true,
            'hotspots' => [
                $this->spot('call'),
                ['id' => 'pic', 'action' => 'custom_image', 'x' => 10, 'y' => 10, 'w' => 40, 'h' => 30, 'value' => 'https://markkito.test/huge/pic.jpg'],
            ],
            'imageColour' => ['tint' => '#ff0000', 'strength' => 80, 'areas' => [['erase' => false, 'points' => [[0, 0], [60, 0], [60, 60], [0, 60]]]]],
        ]);

        // Opening it takes more than the 256MB the live server gives a request
        // by default, so building the PDF makes room for it (CardPdf::makeRoom).
        memory_reset_peak_usage();
        $pdf = $this->get('/card/spice-garden.pdf')->assertOk()->getContent();
        $this->assertSame('512M', ini_get('memory_limit'));
        $this->assertLessThan(400 * 1024 * 1024, memory_get_peak_usage());
        $this->assertStringStartsWith('%PDF', $pdf);
        // The photo itself, and the picture on it, both made it in.
        $this->assertGreaterThanOrEqual(2, preg_match_all('~/Subtype\s*/Image~', $pdf));
    }

    public function test_the_dashboard_pdf_is_always_the_card_shown_never_another_design(): void
    {
        // The card's image can't be fetched from its web address on this server.
        Http::fake(['markkito.test/cards/*' => Http::response('', 500)]);
        $jpeg = function (): string {
            $img = imagecreatetruecolor(600, 1000);
            imagefill($img, 0, 0, imagecolorallocate($img, 200, 30, 30));
            ob_start();
            imagejpeg($img);

            return (string) ob_get_clean();
        };
        BusinessCard::updateOrCreate(['businessId' => $this->business->id], [
            'imageUrl' => 'https://markkito.test/cards/images/mine.jpg', 'imageWidth' => 600, 'imageHeight' => 1000,
            'hotspots' => [$this->spot('call')], 'isPublished' => true,
        ]);
        $this->withoutVite();
        $this->post('/login', ['email' => $this->ownerEmail, 'password' => 'Password123!']);
        $download = "/dashboard/businesses/{$this->business->id}/card.pdf";

        // Read straight from storage instead: the card's own image, as one picture filling the page.
        Storage::fake('spaces');
        Storage::disk('spaces')->put('cards/images/mine.jpg', $jpeg());
        $pdf = $this->get($download)->assertOk()->getContent();
        $this->assertStringStartsWith('%PDF', $pdf);
        $this->assertSame(1, preg_match_all('~/Subtype\s*/Image~', $pdf));

        // Not in storage either: a clear error, not a PDF of some other design.
        Storage::disk('spaces')->delete('cards/images/mine.jpg');
        \Illuminate\Support\Facades\Cache::flush();
        $this->get($download)->assertStatus(503)->assertSee('could not be loaded');
    }

    public function test_oversized_card_images_are_shrunk_with_the_actions_left_in_place(): void
    {
        Storage::fake('spaces');
        $img = imagecreatetruecolor(3000, 5000);
        imagefill($img, 0, 0, imagecolorallocate($img, 20, 120, 60));
        ob_start();
        imagepng($img);
        Http::fake(['markkito.test/big/*' => Http::response((string) ob_get_clean(), 200, ['Content-Type' => 'image/png'])]);
        unset($img);
        $card = BusinessCard::updateOrCreate(['businessId' => $this->business->id], [
            'imageUrl' => 'https://markkito.test/big/card.png', 'imageWidth' => 3000, 'imageHeight' => 5000,
            'hotspots' => [$this->spot('call', ['x' => 12.5, 'y' => 80])],
        ]);

        // Listed first, changed only with --apply.
        $this->artisan('cards:shrink-images')->expectsOutputToContain('3000x5000')->assertSuccessful();
        $this->assertSame('https://markkito.test/big/card.png', $card->fresh()->imageUrl);

        $this->artisan('cards:shrink-images --apply')->expectsOutputToContain('1 of 1 shrunk')->assertSuccessful();
        $card->refresh();
        $this->assertSame(1200, $card->imageWidth);
        $this->assertSame(2000, $card->imageHeight);
        $this->assertStringContainsString('cards/images/', $card->imageUrl);
        $this->assertCount(1, Storage::disk('spaces')->files('cards/images'));
        // The actions sit in percent of the image: unchanged.
        $this->assertSame(12.5, (float) $card->hotspots[0]['x']);

        $this->artisan('cards:shrink-images')->expectsOutputToContain('No card images over')->assertSuccessful();
    }

    public function test_the_pdf_links_over_the_artwork_carry_no_visible_names(): void
    {
        $this->save([$this->spot('call'), $this->spot('whatsapp', ['y' => 50]), $this->spot('directions', ['y' => 30])])->assertOk();
        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $pdf = $this->get('/card/spice-garden.pdf')->assertOk()->getContent();

        // Still clickable: a link over each action.
        $this->assertStringContainsString('tel:9876543210', $pdf);
        $this->assertStringContainsString('wa.me', $pdf);
        // But no text drawn on the card: the artwork shows its own icons.
        // (No text-drawing operators, BT ... ET, in the page's content streams.)
        $this->assertDoesNotMatchRegularExpression('~(^|\s)BT\s~', self::pdfDrawing($pdf));
    }

    public function test_a_free_image_can_be_zoomed_out_smaller_than_its_box(): void
    {
        // Zoomed out: half the box's size, in its middle. Kept inside the box if pushed past it.
        $this->assertSame(['l' => 25.0, 't' => 25.0, 'w' => 50.0, 'h' => 50.0], \App\Support\Cards\ImageCard::fit(['l' => 25, 't' => 25, 'w' => 50, 'h' => 50]));
        $this->assertSame(['l' => 50.0, 't' => 0.0, 'w' => 50.0, 'h' => 50.0], \App\Support\Cards\ImageCard::fit(['l' => 80, 't' => -20, 'w' => 50, 'h' => 50]));
        // Zoomed in, as before: it covers the box.
        $this->assertSame(['l' => -100.0, 't' => 0.0, 'w' => 200.0, 'h' => 100.0], \App\Support\Cards\ImageCard::fit(['l' => -150, 't' => 10, 'w' => 200, 'h' => 100]));

        $spot = $this->spot('custom_image', ['value' => 'https://cdn.example.test/pic.jpg', 'fit' => ['l' => 25, 't' => 25, 'w' => 50, 'h' => 50]]);
        $this->save([$spot])->assertOk()->assertJsonPath('data.hotspots.0.fit.w', 50);

        // The PDF draws it small, with clear space around it in the box.
        $shaped = new \ReflectionMethod(\App\Support\Cards\CardPdf::class, 'shapedPng');
        $png = $shaped->invoke(null, 'https://cdn.example.test/pic.jpg', 100, 100, [[0, 0], [100, 0], [100, 100], [0, 100]], ['l' => 25, 't' => 25, 'w' => 50, 'h' => 50]);
        $img = imagecreatefromstring(base64_decode(substr($png, strlen('data:image/png;base64,'))));
        $alpha = fn (float $fx, float $fy) => (imagecolorat($img, (int) (imagesx($img) * $fx), (int) (imagesy($img) * $fy)) >> 24) & 0x7F;
        $this->assertSame(127, $alpha(0.1, 0.1), 'clear around the picture');
        $this->assertSame(0, $alpha(0.5, 0.5), 'the picture in the middle');
        $this->assertSame(127, $alpha(0.9, 0.9), 'clear on the far side');

        $this->postJson("/api/v1/businesses/{$this->business->id}/card/publish", [], $this->auth)->assertOk();
        $this->get('/card/spice-garden.pdf')->assertOk();
        $this->assertStringContainsString('left:25%;top:25%;width:50%;height:50%', $this->get('/card/spice-garden')->getContent());
    }

    /** A PDF's page drawing commands, unpacked from its content streams. */
    private static function pdfDrawing(string $pdf): string
    {
        preg_match_all('~stream\r?\n(.*?)\r?\nendstream~s', $pdf, $m);

        return "\n".implode("\n", array_map(fn ($s) => @gzuncompress($s) ?: '', $m[1]));
    }
}
