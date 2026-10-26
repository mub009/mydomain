<?php

namespace Tests\Feature;

use App\Models\GoldRateTemplate;
use App\Models\User;
use App\Support\GoldRates\GoldRateFiles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

// The admin's gold-rate poster maker: templates kept exactly as uploaded,
// layouts saved and validated against the template's size, shared rates,
// duplicating and deleting — and none of it open to anyone else.
class GoldRateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(GoldRateFiles::DISK);
        $this->withoutVite();
    }

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

        return ['Authorization' => "Bearer {$token}", 'Accept' => 'application/json'];
    }

    private function uploadTemplate(array $auth, int $width = 800, int $height = 600, string $name = 'Daily rate'): array
    {
        return $this->post('/api/v1/admin/gold-rates/templates', [
            'name' => $name,
            'file' => UploadedFile::fake()->image('master.png', $width, $height),
        ], $auth)->assertStatus(201)->json('data');
    }

    public function test_a_template_is_stored_byte_for_byte_with_a_default_layout(): void
    {
        $auth = $this->auth($this->user('ADMIN'));
        $file = UploadedFile::fake()->image('master.png', 1080, 1350);
        $original = file_get_contents($file->getRealPath());

        $data = $this->post('/api/v1/admin/gold-rates/templates', ['name' => 'Instagram post', 'file' => $file], $auth)
            ->assertStatus(201)
            ->assertJsonPath('data.imageWidth', 1080)
            ->assertJsonPath('data.imageHeight', 1350)
            ->assertJsonPath('data.layout.fields.24K.visible', true)
            ->assertJsonPath('data.layout.fields.18K.visible', false)
            ->assertJsonMissingPath('data.imagePath')
            ->json('data');

        $template = GoldRateTemplate::find($data['id']);
        $this->assertSame(hash('sha256', $original), hash('sha256', Storage::disk(GoldRateFiles::DISK)->get($template->imagePath)));
        $this->assertNotSame($template->imagePath, $template->thumbPath);
        Storage::disk(GoldRateFiles::DISK)->assertExists($template->thumbPath);
    }

    public function test_a_template_must_be_a_png(): void
    {
        $auth = $this->auth($this->user('ADMIN'));

        $this->post('/api/v1/admin/gold-rates/templates', [
            'name' => 'Photo', 'file' => UploadedFile::fake()->image('photo.jpg', 400, 400),
        ], $auth)->assertStatus(400)->assertJsonPath('error.message', 'The template must be a PNG image');
        $this->assertSame(0, GoldRateTemplate::count());
    }

    public function test_a_file_over_the_php_limit_says_so(): void
    {
        $auth = $this->auth($this->user('ADMIN'));
        // What PHP hands over when a file exceeds upload_max_filesize.
        $tooBig = new UploadedFile(UploadedFile::fake()->image('big.png')->getRealPath(), 'big.png', 'image/png', UPLOAD_ERR_INI_SIZE, true);

        $this->post('/api/v1/admin/gold-rates/templates', ['name' => 'Big', 'file' => $tooBig], $auth)
            ->assertStatus(400)
            ->assertJsonPath('error.message', fn ($m) => str_contains($m, 'larger than this server accepts') && str_contains($m, 'upload_max_filesize'));
    }

    public function test_only_admins_reach_the_api_and_the_images(): void
    {
        $admin = $this->auth($this->user('ADMIN'));
        $template = $this->uploadTemplate($admin);
        $dealer = $this->user('DEALER');

        $this->getJson('/api/v1/admin/gold-rates/templates', $this->auth($dealer))->assertStatus(403);
        $this->post('/api/v1/admin/gold-rates/templates', ['name' => 'x', 'file' => UploadedFile::fake()->image('m.png')], $this->auth($dealer))
            ->assertStatus(403);
        $this->getJson('/api/v1/admin/gold-rates/rates')->assertStatus(401);

        // The image and editor pages need an admin session.
        $this->get("/admin/gold-rates/templates/{$template['id']}/image")->assertRedirect('/login');
        $this->post('/login', ['email' => $dealer->email, 'password' => 'Password123!']);
        $this->get("/admin/gold-rates/templates/{$template['id']}/image")->assertRedirect('/');
        $this->get("/admin/gold-rates/templates/{$template['id']}")->assertRedirect('/');
    }

    public function test_an_admin_opens_the_tab_the_editor_and_the_images(): void
    {
        $admin = $this->user('ADMIN');
        $template = $this->uploadTemplate($this->auth($admin), 640, 480, 'Shop window');
        $this->post('/login', ['email' => $admin->email, 'password' => 'Password123!']);

        $this->get('/admin?tab=Gold%20Rates')->assertOk()->assertSee('Shop window')->assertSee("Today's gold rates", false);
        $this->get("/admin/gold-rates/templates/{$template['id']}")->assertOk()->assertSee('Download Final PNG')->assertSee('gold-rate-editor-data');

        $image = $this->get("/admin/gold-rates/templates/{$template['id']}/image")->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->assertSame([640, 480], array_slice(getimagesizefromstring($image->streamedContent()), 0, 2));
        $thumb = $this->get("/admin/gold-rates/templates/{$template['id']}/thumb")->assertOk();
        $this->assertSame(480, getimagesizefromstring($thumb->streamedContent())[0]);
    }

    public function test_the_layout_is_saved_and_checked_against_the_template_size(): void
    {
        $auth = $this->auth($this->user('ADMIN'));
        $template = $this->uploadTemplate($auth, 800, 600);
        $layout = $template['layout'];
        $layout['logo'] = ['visible' => true, 'x' => 600, 'y' => 20.256, 'width' => 180, 'height' => 90];
        $layout['fields']['21K'] = [...$layout['fields']['21K'], 'visible' => true, 'fontFamily' => 'Noto Sans Malayalam', 'fontWeight' => 800,
            'color' => '#C9A227', 'background' => '#000000', 'align' => 'left', 'label' => '21 കാരറ്റ്', 'currency' => 'AED'];

        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['name' => 'Renamed', 'layout' => $layout], $auth)
            ->assertOk()
            ->assertJsonPath('data.name', 'Renamed')
            ->assertJsonPath('data.layout.logo.x', 600)
            ->assertJsonPath('data.layout.logo.y', 20.26)
            ->assertJsonPath('data.layout.fields.21K.visible', true)
            ->assertJsonPath('data.layout.fields.21K.color', '#c9a227')
            ->assertJsonPath('data.layout.fields.21K.label', '21 കാരറ്റ്');
        // Reopening shows the saved layout unchanged.
        $this->getJson("/api/v1/admin/gold-rates/templates/{$template['id']}", $auth)
            ->assertJsonPath('data.layout.fields.21K.fontFamily', 'Noto Sans Malayalam')
            ->assertJsonPath('data.layout.fields.21K.background', '#000000');

        $bad = fn (array $change) => array_replace_recursive($layout, $change);
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $bad(['fields' => ['24K' => ['fontFamily' => 'Comic Sans MS']]])], $auth)
            ->assertStatus(400)->assertJsonPath('error.code', 'VALIDATION_ERROR');
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $bad(['fields' => ['24K' => ['color' => 'red']]])], $auth)
            ->assertStatus(400);
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $bad(['logo' => ['x' => 700]])], $auth)
            ->assertStatus(400)->assertJsonPath('error.message', 'The logo runs off the edge of the template');
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $bad(['logo' => ['script' => 'x']])], $auth)
            ->assertStatus(400);
        $missing = $layout;
        unset($missing['fields']['18K']);
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $missing], $auth)->assertStatus(400);

        $this->assertSame(600, (int) GoldRateTemplate::find($template['id'])->layout['logo']['x']);
    }

    public function test_rate_box_styles_are_saved_and_older_layouts_get_defaults(): void
    {
        $auth = $this->auth($this->user('ADMIN'));
        $template = $this->uploadTemplate($auth, 800, 600);
        $layout = $template['layout'];
        $this->assertSame('plain', $layout['fields']['24K']['design']);

        // A "Dark badge"-style split box.
        $layout['fields']['22K'] = [...$layout['fields']['22K'], 'design' => 'split', 'radius' => 8.5, 'borderColor' => '#D4A017',
            'borderWidth' => 2, 'background2' => null, 'shadow' => true, 'labelColor' => '#1a1a1a', 'labelBackground' => '#d4a017',
            'splitRatio' => 0.42, 'background' => '#1a1a1a'];
        // A box saved before the style keys existed.
        $layout['fields']['18K'] = array_diff_key($layout['fields']['18K'], array_flip(['design', 'radius', 'borderColor', 'borderWidth',
            'background2', 'shadow', 'labelColor', 'labelBackground', 'splitRatio']));

        $saved = $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $layout], $auth)
            ->assertOk()->json('data.layout.fields');
        $this->assertSame('split', $saved['22K']['design']);
        $this->assertSame('#d4a017', $saved['22K']['borderColor']);
        $this->assertTrue($saved['22K']['shadow']);
        $this->assertEqualsWithDelta(0.42, $saved['22K']['splitRatio'], 0.0001);
        $this->assertSame('plain', $saved['18K']['design']);
        $this->assertSame($saved['18K']['color'], $saved['18K']['labelColor']);

        $bad = fn (array $change) => array_replace_recursive($layout, ['fields' => ['22K' => $change]]);
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $bad(['design' => 'fancy'])], $auth)->assertStatus(400);
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $bad(['splitRatio' => 0.95])], $auth)->assertStatus(400);
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $bad(['borderColor' => 'gold'])], $auth)->assertStatus(400);

        // Shapes, gradient direction, label gradient, glow and capitals.
        $fancy = $bad(['shape' => 'ribbon', 'gradientDirection' => 'diagonal', 'labelBackground2' => '#A87B0F', 'glowColor' => '#ffcc4d', 'uppercase' => true]);
        $saved = $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $fancy], $auth)->assertOk()->json('data.layout.fields');
        $this->assertSame(['ribbon', 'diagonal', '#a87b0f', '#ffcc4d', true],
            [$saved['22K']['shape'], $saved['22K']['gradientDirection'], $saved['22K']['labelBackground2'], $saved['22K']['glowColor'], $saved['22K']['uppercase']]);
        $this->assertSame(['rect', 'vertical', null, null, false],
            [$saved['18K']['shape'], $saved['18K']['gradientDirection'], $saved['18K']['labelBackground2'], $saved['18K']['glowColor'], $saved['18K']['uppercase']]);
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $bad(['shape' => 'star'])], $auth)->assertStatus(400);
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $bad(['gradientDirection' => 'radial'])], $auth)->assertStatus(400);
    }

    public function test_a_design_is_saved_as_a_preset_listed_and_deleted(): void
    {
        $auth = $this->auth($this->user('ADMIN'));
        $style = [
            'design' => 'split', 'background' => '#1A1A1A', 'background2' => null, 'radius' => 0.2, 'borderColor' => '#d4a017',
            'border' => 0.04, 'shadow' => true, 'color' => '#ffd778', 'labelColor' => '#1a1a1a', 'labelBackground' => '#d4a017',
            'splitRatio' => 0.42, 'fontFamily' => 'Montserrat', 'fontWeight' => 800, 'fontScale' => 0.5, 'text' => '{currency}{rate}/g',
            'align' => 'center',
        ];

        $preset = $this->postJson('/api/v1/admin/gold-rates/presets', ['name' => ' Diwali gold ', 'style' => $style], $auth)
            ->assertStatus(201)
            ->assertJsonPath('data.name', 'Diwali gold')
            ->assertJsonPath('data.style.background', '#1a1a1a')
            ->assertJsonPath('data.style.text', '{currency}{rate}/g')
            ->json('data');
        $this->getJson('/api/v1/admin/gold-rates/presets', $auth)->assertOk()->assertJsonPath('data.0.id', $preset['id']);

        // It reaches the editor of every template.
        $template = $this->uploadTemplate($auth);
        $admin = User::where('role', 'ADMIN')->first();
        $this->post('/login', ['email' => $admin->email, 'password' => 'Password123!']);
        $this->get("/admin/gold-rates/templates/{$template['id']}")->assertOk()->assertSee('Diwali gold');

        $this->postJson('/api/v1/admin/gold-rates/presets', ['name' => 'Bad', 'style' => [...$style, 'fontFamily' => 'Comic Sans MS']], $auth)->assertStatus(400);
        $this->postJson('/api/v1/admin/gold-rates/presets', ['name' => 'Bad', 'style' => [...$style, 'radius' => 3]], $auth)->assertStatus(400);
        $this->postJson('/api/v1/admin/gold-rates/presets', ['name' => 'Bad', 'style' => [...$style, 'onclick' => 'x']], $auth)->assertStatus(400);
        $this->postJson('/api/v1/admin/gold-rates/presets', ['name' => '', 'style' => $style], $auth)->assertStatus(400);
        $this->postJson('/api/v1/admin/gold-rates/presets', ['name' => 'Mine', 'style' => $style], $this->auth($this->user('DEALER')))->assertStatus(403);

        $this->deleteJson("/api/v1/admin/gold-rates/presets/{$preset['id']}", [], $auth)->assertStatus(204);
        $this->getJson('/api/v1/admin/gold-rates/presets', $auth)->assertJsonCount(0, 'data');
    }

    public function test_the_master_image_can_be_changed_keeping_the_layout(): void
    {
        $auth = $this->auth($this->user('ADMIN'));
        $template = $this->uploadTemplate($auth, 800, 600);
        $layout = $template['layout'];
        $layout['logo'] = ['visible' => true, 'x' => 600, 'y' => 20, 'width' => 180, 'height' => 90];
        $layout['fields']['22K'] = [...$layout['fields']['22K'], 'fontSize' => 40, 'radius' => 10, 'borderWidth' => 2];
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $layout], $auth)->assertOk();
        $oldPath = GoldRateTemplate::find($template['id'])->imagePath;

        // Same size: the layout is untouched, the file and URL change.
        $file = UploadedFile::fake()->image('new.png', 800, 600);
        $bytes = file_get_contents($file->getRealPath());
        $same = $this->post("/api/v1/admin/gold-rates/templates/{$template['id']}/image", ['file' => $file], $auth)
            ->assertOk()->json('data');
        $this->assertEquals($layout['logo'], $same['layout']['logo']);
        $this->assertNotSame($template['imageUrl'], $same['imageUrl']);
        Storage::disk(GoldRateFiles::DISK)->assertMissing($oldPath);
        $this->assertSame($bytes, Storage::disk(GoldRateFiles::DISK)->get(GoldRateTemplate::find($template['id'])->imagePath));

        // Twice the size: everything scales with it.
        $big = $this->post("/api/v1/admin/gold-rates/templates/{$template['id']}/image", [
            'file' => UploadedFile::fake()->image('big.png', 1600, 1200),
        ], $auth)->assertOk()->assertJsonPath('data.imageWidth', 1600)->json('data.layout');
        $this->assertEquals(['visible' => true, 'x' => 1200, 'y' => 40, 'width' => 360, 'height' => 180], $big['logo']);
        $this->assertEquals(80, $big['fields']['22K']['fontSize']);
        $this->assertEquals(20, $big['fields']['22K']['radius']);
        $this->assertEquals(4, $big['fields']['22K']['borderWidth']);

        // A wrong file leaves the template as it was.
        $before = GoldRateTemplate::find($template['id'])->imagePath;
        $this->post("/api/v1/admin/gold-rates/templates/{$template['id']}/image", [
            'file' => UploadedFile::fake()->image('photo.jpg', 400, 400),
        ], $auth)->assertStatus(400);
        $this->assertSame($before, GoldRateTemplate::find($template['id'])->imagePath);
        Storage::disk(GoldRateFiles::DISK)->assertExists($before);

        // A narrower image keeps every box inside it.
        $narrow = $this->post("/api/v1/admin/gold-rates/templates/{$template['id']}/image", [
            'file' => UploadedFile::fake()->image('narrow.png', 400, 1200),
        ], $auth)->assertOk()->json('data.layout');
        foreach ([$narrow['logo'], ...array_values($narrow['fields'])] as $b) {
            $this->assertLessThanOrEqual(400, $b['x'] + $b['width']);
            $this->assertLessThanOrEqual(1200, $b['y'] + $b['height']);
        }
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $narrow], $auth)->assertOk();
    }

    private function business(array $overrides = []): \App\Models\Business
    {
        $owner = $this->user('BUSINESS_OWNER');
        $category = \App\Models\Category::firstOrCreate(['slug' => 'jewellers'], ['name' => 'Jewellers']);
        $business = \App\Models\Business::create([
            'ownerId' => $owner->id, 'name' => 'Lakshmi Jewellers', 'slug' => 'lakshmi-jewellers', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '+91 98765 43210', 'addressLine1' => 'MG Road', 'city' => 'Palakkad', 'state' => 'KL',
            'postalCode' => '678001', 'latitude' => 10.77, 'longitude' => 76.65, 'website' => 'https://www.lakshmi.example/',
            'instagramUsername' => 'lakshmigold', 'description' => 'Pure gold since 1970. Hallmarked jewellery for every occasion.',
            ...$overrides,
        ]);
        \App\Models\BusinessHours::create(['businessId' => $business->id, 'dayOfWeek' => 1, 'openTime' => '10:00', 'closeTime' => '20:00', 'isClosed' => false]);

        return $business;
    }

    public function test_a_template_links_a_business_and_places_its_details(): void
    {
        $auth = $this->auth($this->user('ADMIN'));
        $template = $this->uploadTemplate($auth, 800, 600);
        $business = $this->business();

        // Every template has the business boxes, hidden until used.
        $this->assertFalse($template['layout']['details']['phone']['visible']);
        $this->assertSame('{name}', $template['layout']['details']['name']['text']);
        $this->assertSame('page', $template['layout']['details']['qr']['target']);
        $this->assertNull($template['businessCard']);

        $card = $this->getJson("/api/v1/admin/gold-rates/businesses/{$business->id}/card", $auth)->assertOk()->json('data');
        $this->assertSame('Lakshmi Jewellers', $card['vars']['name']);
        $this->assertSame('MG Road, Palakkad', $card['vars']['address']);
        $this->assertSame('www.lakshmi.example', $card['vars']['website']);
        $this->assertSame('@lakshmigold', $card['vars']['instagram']);
        $this->assertSame('Pure gold since 1970.', $card['vars']['tagline']);
        $this->assertStringEndsWith('/business/lakshmi-jewellers', $card['pageUrl']);
        $this->assertSame('10:00', $card['hours'][0]['openTime']);
        $this->getJson('/api/v1/admin/gold-rates/businesses/00000000-0000-0000-0000-000000000000/card', $auth)->assertStatus(404);

        $layout = $template['layout'];
        $layout['details']['phone'] = [...$layout['details']['phone'], 'visible' => true, 'design' => 'split', 'label' => 'Call'];
        $layout['details']['qr'] = [...$layout['details']['qr'], 'visible' => true, 'target' => 'website'];
        $saved = $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['businessId' => $business->id, 'layout' => $layout], $auth)
            ->assertOk()
            ->assertJsonPath('data.businessCard.name', 'Lakshmi Jewellers')
            ->assertJsonPath('data.layout.details.phone.visible', true)
            ->assertJsonPath('data.layout.details.qr.target', 'website')
            ->json('data');
        $this->assertSame('Call {phone}', $saved['layout']['details']['phone']['text']);

        // Its details stay current: a new phone number shows next time.
        $business->update(['phone' => '0491 222 333']);
        $this->getJson("/api/v1/admin/gold-rates/templates/{$template['id']}", $auth)->assertJsonPath('data.businessCard.vars.phone', '0491 222 333');

        // A duplicate keeps the business.
        $this->postJson("/api/v1/admin/gold-rates/templates/{$template['id']}/duplicate", [], $auth)
            ->assertStatus(201)->assertJsonPath('data.businessCard.id', $business->id);

        $bad = fn (array $change) => ['layout' => array_replace_recursive($layout, $change)];
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", $bad(['details' => ['qr' => ['target' => 'instagram']]]), $auth)->assertStatus(400);
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", $bad(['details' => ['phone' => ['x' => 700]]]), $auth)
            ->assertStatus(400)->assertJsonPath('error.message', 'The phone box runs off the edge of the template');
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", $bad(['logo' => ['source' => 'elsewhere']]), $auth)->assertStatus(400);
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['businessId' => '00000000-0000-0000-0000-000000000000'], $auth)->assertStatus(400);

        // Deleting the business unlinks it; the template stays.
        $business->delete();
        $this->getJson("/api/v1/admin/gold-rates/templates/{$template['id']}", $auth)->assertOk()->assertJsonPath('data.businessCard', null);
    }

    public function test_a_layout_saved_before_business_details_still_loads_and_saves(): void
    {
        $auth = $this->auth($this->user('ADMIN'));
        $template = $this->uploadTemplate($auth, 800, 600);
        $old = $template['layout'];
        unset($old['details']);
        // Layouts from when a logo could come from an uploaded library.
        $old['logo']['source'] = 'library';
        \Illuminate\Support\Facades\DB::table('gold_rate_templates')->where('id', $template['id'])->update(['layout' => json_encode($old)]);

        $loaded = $this->getJson("/api/v1/admin/gold-rates/templates/{$template['id']}", $auth)->assertOk()->json('data.layout');
        $this->assertArrayNotHasKey('source', $loaded['logo']);
        unset($old['logo']['source']);
        $this->assertArrayHasKey('qr', $loaded['details']);
        // Saving without details keeps their defaults.
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $old], $auth)
            ->assertOk()->assertJsonPath('data.layout.details.hours.text', '{hours}');
    }

    public function test_a_business_logo_is_served_only_from_the_sites_own_storage(): void
    {
        config(['filesystems.disks.spaces.url' => 'https://cdn.markkito.test']);
        $admin = $this->user('ADMIN');
        $file = UploadedFile::fake()->image('logo.png', 120, 60);
        $png = file_get_contents($file->getRealPath());
        \Illuminate\Support\Facades\Http::fake(['cdn.markkito.test/*' => \Illuminate\Support\Facades\Http::response($png, 200, ['Content-Type' => 'image/png'])]);
        $ours = $this->business(['logoUrl' => 'https://cdn.markkito.test/businesses/logos/a.png']);
        $theirs = $this->business(['slug' => 'elsewhere', 'logoUrl' => 'http://169.254.169.254/latest/meta-data']);

        $this->post('/login', ['email' => $admin->email, 'password' => 'Password123!']);
        $served = $this->get("/admin/gold-rates/businesses/{$ours->id}/logo")->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->assertSame($png, $served->getContent());
        $this->get("/admin/gold-rates/businesses/{$theirs->id}/logo")->assertStatus(400);
        \Illuminate\Support\Facades\Http::assertSentCount(1);

        $this->assertStringContainsString("/admin/gold-rates/businesses/{$ours->id}/logo", \App\Support\GoldRates\BusinessCard::for($ours)['logoUrl']);
    }

    public function test_rates_are_shared_and_can_be_cleared(): void
    {
        $auth = $this->auth($this->user('ADMIN'));

        $this->getJson('/api/v1/admin/gold-rates/rates', $auth)->assertOk()->assertJsonPath('data.rates.22K', null);
        $this->putJson('/api/v1/admin/gold-rates/rates', ['rates' => ['24K' => 7480, '22K' => '6850.5', '21K' => null, '18K' => 5610]], $auth)
            ->assertOk()
            ->assertJsonPath('data.rates.24K', 7480)
            ->assertJsonPath('data.rates.22K', 6850.5)
            ->assertJsonPath('data.rates.21K', null);
        $this->putJson('/api/v1/admin/gold-rates/rates', ['rates' => ['22K' => null]], $auth)->assertOk()->assertJsonPath('data.rates.22K', null)
            ->assertJsonPath('data.rates.24K', 7480);

        $this->putJson('/api/v1/admin/gold-rates/rates', ['rates' => ['22K' => -1]], $auth)->assertStatus(400);
        $this->putJson('/api/v1/admin/gold-rates/rates', ['rates' => ['14K' => 100]], $auth)->assertStatus(400);
    }

    public function test_a_duplicate_has_its_own_copy_of_the_master(): void
    {
        $auth = $this->auth($this->user('ADMIN'));
        $template = $this->uploadTemplate($auth);
        $layout = $template['layout'];
        $layout['fields']['22K']['fontSize'] = 61;
        $this->patchJson("/api/v1/admin/gold-rates/templates/{$template['id']}", ['layout' => $layout], $auth)->assertOk();

        $copy = $this->postJson("/api/v1/admin/gold-rates/templates/{$template['id']}/duplicate", [], $auth)
            ->assertStatus(201)
            ->assertJsonPath('data.name', 'Daily rate (Copy)')
            ->assertJsonPath('data.layout.fields.22K.fontSize', 61)
            ->json('data');

        $originalPath = GoldRateTemplate::find($template['id'])->imagePath;
        $copyPath = GoldRateTemplate::find($copy['id'])->imagePath;
        $this->assertNotSame($originalPath, $copyPath);

        $this->deleteJson("/api/v1/admin/gold-rates/templates/{$template['id']}", [], $auth)->assertStatus(204);
        Storage::disk(GoldRateFiles::DISK)->assertMissing($originalPath);
        Storage::disk(GoldRateFiles::DISK)->assertExists($copyPath);
        $this->assertNull(GoldRateTemplate::find($template['id']));
    }
}
