<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UploadTest extends TestCase
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

    private function token(User $user): string
    {
        return $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!'])
            ->json('data.accessToken');
    }

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('spaces');
        // Never the real AI in tests; the AI tests fake it.
        config(['services.gemini.key' => null]);
        Http::preventStrayRequests();
    }

    public function test_a_business_owner_uploads_a_photo_and_gets_back_a_url(): void
    {
        $owner = $this->user('BUSINESS_OWNER');
        $token = $this->token($owner);

        $response = $this->post('/api/v1/uploads/image', [
            'purpose' => 'business-photos',
            'file' => UploadedFile::fake()->image('shopfront.jpg', 20, 20),
        ], ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(200)->assertJsonStructure(['data' => ['url']]);
        $url = $response->json('data.url');
        $this->assertStringContainsString('businesses/photos/', $url);

        Storage::disk('spaces')->assertExists(str_replace(Storage::disk('spaces')->url(''), '', $url));
    }

    public function test_a_jpeg_upload_is_converted_to_webp(): void
    {
        $owner = $this->user('BUSINESS_OWNER');
        $token = $this->token($owner);

        // Large and detailed enough that WebP genuinely comes out smaller —
        // a tiny placeholder image can occasionally not shrink under WebP's
        // per-file overhead.
        $response = $this->post('/api/v1/uploads/image', [
            'purpose' => 'business-photos',
            'file' => UploadedFile::fake()->image('shopfront.jpg', 800, 600),
        ], ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(200);
        $url = $response->json('data.url');
        $this->assertStringEndsWith('.webp', $url);

        $path = str_replace(Storage::disk('spaces')->url(''), '', $url);
        $stored = Storage::disk('spaces')->get($path);
        $this->assertSame('image/webp', Storage::disk('spaces')->mimeType($path));
        $this->assertStringStartsWith('RIFF', $stored);
        $this->assertStringContainsString('WEBP', substr($stored, 0, 16));
    }

    public function test_a_png_with_transparency_converts_to_webp_and_keeps_its_alpha_channel(): void
    {
        $admin = $this->user('ADMIN');
        $token = $this->token($admin);

        // Genuinely random per-pixel colour (not just a gradient — deflate
        // compresses smooth ramps just as well as WebP does) so PNG's
        // lossless compression can't do anything with it, the way it
        // couldn't with a real photo's noise. Otherwise a small, flat PNG
        // can legitimately beat a lossy WebP re-encode, and the optimizer
        // correctly keeps the PNG (see the "only if it pays off" fallback
        // in ImageOptimizer) — this fixture is deliberately built to defeat
        // that so the WebP path under test actually runs.
        mt_srand(42);
        $image = imagecreatetruecolor(200, 200);
        imagesavealpha($image, true);
        imagealphablending($image, false);
        for ($y = 0; $y < 200; $y++) {
            for ($x = 0; $x < 200; $x++) {
                if ($x < 10 && $y < 10) {
                    $color = imagecolorallocatealpha($image, 0, 0, 0, 127); // transparent corner
                } else {
                    $color = imagecolorallocatealpha($image, mt_rand(0, 255), mt_rand(0, 255), mt_rand(0, 255), 0);
                }
                imagesetpixel($image, $x, $y, $color);
            }
        }
        ob_start();
        imagepng($image);
        $pngBytes = ob_get_clean();
        imagedestroy($image);

        $tmpPath = tempnam(sys_get_temp_dir(), 'logo').'.png';
        file_put_contents($tmpPath, $pngBytes);
        $file = new UploadedFile($tmpPath, 'logo.png', 'image/png', null, true);

        $response = $this->post('/api/v1/uploads/image', [
            'purpose' => 'categories',
            'file' => $file,
        ], ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(200);
        $url = $response->json('data.url');
        $this->assertStringEndsWith('.webp', $url);

        $path = str_replace(Storage::disk('spaces')->url(''), '', $url);
        $decoded = imagecreatefromstring(Storage::disk('spaces')->get($path));
        // Top-left corner was filled fully transparent — still should be.
        $corner = imagecolorat($decoded, 1, 1);
        $alpha = ($corner >> 24) & 0x7F;
        $this->assertSame(127, $alpha, 'corner pixel should still be fully transparent after WebP conversion');
        imagedestroy($decoded);

        @unlink($tmpPath);
    }

    public function test_an_animated_gif_upload_is_left_untouched_so_its_frames_are_not_destroyed(): void
    {
        $owner = $this->user('BUSINESS_OWNER');
        $token = $this->token($owner);

        $file = UploadedFile::fake()->image('animated.gif', 40, 40);

        $response = $this->post('/api/v1/uploads/image', [
            'purpose' => 'business-photos',
            'file' => $file,
        ], ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(200)->assertJsonPath('data.url', fn ($url) => str_ends_with($url, '.gif'));
    }

    public function test_an_oversized_photo_is_downscaled_to_the_max_display_dimension(): void
    {
        $owner = $this->user('BUSINESS_OWNER');
        $token = $this->token($owner);

        $response = $this->post('/api/v1/uploads/image', [
            'purpose' => 'business-photos',
            // Larger than ImageOptimizer's 2000px cap on both edges.
            'file' => UploadedFile::fake()->image('big-photo.jpg', 3000, 2400),
        ], ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(200);
        $path = str_replace(Storage::disk('spaces')->url(''), '', $response->json('data.url'));
        $stored = Storage::disk('spaces')->get($path);

        [$width, $height] = getimagesizefromstring($stored);
        $this->assertLessThanOrEqual(2000, max($width, $height));
        // Aspect ratio (3000:2400 = 5:4) is preserved, not stretched.
        $this->assertEqualsWithDelta(3000 / 2400, $width / $height, 0.01);
    }

    public function test_rejects_a_file_larger_than_the_5mb_raster_limit(): void
    {
        $owner = $this->user('BUSINESS_OWNER');
        $token = $this->token($owner);

        // Real (non-image) bytes, not just a declared size — ImageOptimizer
        // can't shrink what GD can't decode, so this still exceeds the
        // limit after the optimization pass runs over it.
        $big = UploadedFile::fake()->createWithContent('huge.jpg', str_repeat('x', 6 * 1024 * 1024));

        $this->post('/api/v1/uploads/image', [
            'purpose' => 'business-photos',
            'file' => $big,
        ], ['Authorization' => "Bearer {$token}"])->assertStatus(400);
    }

    public function test_rejects_a_file_that_is_not_actually_an_image(): void
    {
        $owner = $this->user('BUSINESS_OWNER');
        $token = $this->token($owner);

        $fake = UploadedFile::fake()->createWithContent('notes.txt', 'just some plain text, not an image');

        $this->post('/api/v1/uploads/image', [
            'purpose' => 'business-photos',
            'file' => $fake,
        ], ['Authorization' => "Bearer {$token}"])->assertStatus(400);
    }

    public function test_a_regular_customer_cannot_upload_a_category_icon(): void
    {
        $customer = $this->user('CUSTOMER');
        $token = $this->token($customer);

        $this->post('/api/v1/uploads/image', [
            'purpose' => 'categories',
            'file' => UploadedFile::fake()->image('icon.png', 10, 10),
        ], ['Authorization' => "Bearer {$token}"])->assertStatus(403);
    }

    public function test_an_admin_uploads_a_category_icon(): void
    {
        $admin = $this->user('ADMIN');
        $token = $this->token($admin);

        $this->post('/api/v1/uploads/image', [
            'purpose' => 'categories',
            'file' => UploadedFile::fake()->image('icon.png', 10, 10),
        ], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)
            ->assertJsonPath('data.url', fn ($url) => str_contains($url, 'categories/'));
    }

    public function test_poster_artwork_accepts_svg_and_strips_a_script_tag(): void
    {
        $admin = $this->user('ADMIN');
        $token = $this->token($admin);

        $svg = <<<'SVG'
            <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
              <script>alert(1)</script>
              <rect width="100" height="100" fill="red" onclick="evil()" />
            </svg>
            SVG;

        $file = UploadedFile::fake()->createWithContent('artwork.svg', $svg);

        $response = $this->post('/api/v1/uploads/image', [
            'purpose' => 'posters',
            'file' => $file,
        ], ['Authorization' => "Bearer {$token}"]);

        $response->assertStatus(200);
        $url = $response->json('data.url');
        $this->assertStringEndsWith('.svg', $url);

        $path = str_replace(Storage::disk('spaces')->url(''), '', $url);
        $stored = Storage::disk('spaces')->get($path);
        $this->assertStringNotContainsString('<script', $stored);
        $this->assertStringNotContainsString('onclick', $stored);
        $this->assertStringContainsString('<rect', $stored);
    }

    public function test_svg_is_rejected_for_a_purpose_that_does_not_allow_it(): void
    {
        $owner = $this->user('BUSINESS_OWNER');
        $token = $this->token($owner);

        $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
        $file = UploadedFile::fake()->createWithContent('logo.svg', $svg);

        $this->post('/api/v1/uploads/image', [
            'purpose' => 'business-logo',
            'file' => $file,
        ], ['Authorization' => "Bearer {$token}"])->assertStatus(400);
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->post('/api/v1/uploads/image', [
            'purpose' => 'business-photos',
            'file' => UploadedFile::fake()->image('x.png', 5, 5),
        ])->assertStatus(401);
    }

    public function test_unknown_purpose_is_rejected(): void
    {
        $owner = $this->user('BUSINESS_OWNER');
        $token = $this->token($owner);

        $this->post('/api/v1/uploads/image', [
            'purpose' => 'not-a-real-purpose',
            'file' => UploadedFile::fake()->image('x.png', 5, 5),
        ], ['Authorization' => "Bearer {$token}"])->assertStatus(400);
    }

    /** A logo: a red square in the middle of a white $size x $size picture. */
    private function logoOnWhite(int $size = 200): UploadedFile
    {
        $img = imagecreatetruecolor($size, $size);
        imagefill($img, 0, 0, imagecolorallocate($img, 255, 255, 255));
        imagefilledrectangle($img, (int) ($size * 0.3), (int) ($size * 0.3), (int) ($size * 0.7), (int) ($size * 0.7), imagecolorallocate($img, 220, 30, 30));
        $path = tempnam(sys_get_temp_dir(), 'logo').'.png';
        imagepng($img, $path);

        return new UploadedFile($path, 'logo.png', 'image/png', null, true);
    }

    private function stored(string $url): \GdImage
    {
        $bytes = Storage::disk('spaces')->get(str_replace(Storage::disk('spaces')->url(''), '', $url));

        return imagecreatefromstring($bytes);
    }

    public function test_a_logo_upload_has_its_plain_background_removed_and_is_enlarged(): void
    {
        $token = $this->token($this->user('DEALER'));
        $response = $this->post('/api/v1/uploads/image', ['purpose' => 'card-logos', 'file' => $this->logoOnWhite()], ['Authorization' => "Bearer {$token}"])
            ->assertOk()->assertJsonPath('data.backgroundRemoved', true);
        $this->assertStringContainsString('cards/logos/', $response->json('data.url'));

        $img = $this->stored($response->json('data.url'));
        // Trimmed to the red square (plus a small margin) and enlarged to a crisp size.
        $this->assertGreaterThanOrEqual(1000, max(imagesx($img), imagesy($img)));
        $this->assertEqualsWithDelta(imagesx($img), imagesy($img), 2);
        // The corner is see-through, the middle is the logo's red.
        $this->assertSame(127, (imagecolorat($img, 0, 0) >> 24) & 0x7F);
        $middle = imagecolorat($img, intdiv(imagesx($img), 2), intdiv(imagesy($img), 2));
        $this->assertSame(0, ($middle >> 24) & 0x7F);
        $this->assertGreaterThan(180, ($middle >> 16) & 0xFF);
    }

    public function test_a_logo_can_keep_its_background(): void
    {
        $token = $this->token($this->user('BUSINESS_OWNER'));
        $response = $this->post('/api/v1/uploads/image', ['purpose' => 'business-logo', 'removeBackground' => '0', 'file' => $this->logoOnWhite()], ['Authorization' => "Bearer {$token}"])
            ->assertOk()->assertJsonPath('data.backgroundRemoved', false);

        $img = $this->stored($response->json('data.url'));
        $corner = imagecolorat($img, 0, 0);
        $this->assertSame(0, ($corner >> 24) & 0x7F);
        $this->assertGreaterThan(240, $corner & 0xFF);
    }

    public function test_a_photo_logo_is_not_cut_out(): void
    {
        // Random noise: no plain background anywhere along the edges.
        $img = imagecreatetruecolor(120, 120);
        mt_srand(7);
        for ($y = 0; $y < 120; $y++) {
            for ($x = 0; $x < 120; $x++) {
                imagesetpixel($img, $x, $y, imagecolorallocate($img, mt_rand(0, 255), mt_rand(0, 255), mt_rand(0, 255)));
            }
        }
        $path = tempnam(sys_get_temp_dir(), 'photo').'.png';
        imagepng($img, $path);

        $token = $this->token($this->user('BUSINESS_OWNER'));
        $this->post('/api/v1/uploads/image', ['purpose' => 'business-logo', 'file' => new UploadedFile($path, 'photo.png', 'image/png', null, true)], ['Authorization' => "Bearer {$token}"])
            ->assertOk()->assertJsonPath('data.backgroundRemoved', false);
    }

    /** What the image model sends back: a red ring (with a hole) on the flat green asked for. */
    private function fakeGemini(): void
    {
        config(['services.gemini.key' => 'test-key', 'services.ai.provider' => null]);
        $img = imagecreatetruecolor(512, 512);
        imagefill($img, 0, 0, imagecolorallocate($img, 2, 250, 4)); // flat, but not exactly #00FF00
        imagefilledrectangle($img, 128, 128, 384, 384, imagecolorallocate($img, 200, 20, 20));
        imagefilledrectangle($img, 224, 224, 288, 288, imagecolorallocate($img, 2, 250, 4)); // the hole inside, like an "O"
        ob_start();
        imagepng($img);
        $png = base64_encode(ob_get_clean());
        Http::fake(['*generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['inlineData' => ['mimeType' => 'image/png', 'data' => $png]]]]]],
        ])]);
    }

    public function test_ai_redraws_the_logo_and_its_background_is_cut_out_holes_and_all(): void
    {
        $this->fakeGemini();
        $token = $this->token($this->user('DEALER'));
        $response = $this->post('/api/v1/uploads/image', ['purpose' => 'card-logos', 'file' => $this->logoOnWhite()], ['Authorization' => "Bearer {$token}"])
            ->assertOk()->assertJsonPath('data.backgroundRemoved', true)->assertJsonPath('data.method', 'ai');

        // Gemini was sent the logo, and asked for the key colour furthest from it (green, for a red logo on white).
        Http::assertSent(function ($request) {
            $parts = $request['contents'][0]['parts'];

            return str_contains($request->url(), ':generateContent')
                && $parts[0]['inlineData']['mimeType'] === 'image/png'
                && str_contains($parts[1]['text'], '#00FF00')
                && $request['generationConfig']['imageConfig']['aspectRatio'] === '1:1';
        });

        $img = $this->stored($response->json('data.url'));
        $size = imagesx($img);
        $this->assertGreaterThanOrEqual(1000, $size);
        $alpha = fn (int $x, int $y) => (imagecolorat($img, $x, $y) >> 24) & 0x7F;
        $this->assertGreaterThanOrEqual(124, $alpha(0, 0), 'background cleared');
        $this->assertGreaterThanOrEqual(124, $alpha(intdiv($size, 2), intdiv($size, 2)), 'the hole inside is cleared too');
        $this->assertSame(0, $alpha(intdiv($size, 8), intdiv($size, 2)), 'the red ring stays');
    }

    public function test_without_working_ai_the_basic_clean_up_is_used(): void
    {
        config(['services.gemini.key' => 'test-key', 'services.ai.provider' => null]);
        Http::fake(['*' => Http::response(['error' => 'quota'], 429)]);
        $token = $this->token($this->user('BUSINESS_OWNER'));
        $this->post('/api/v1/uploads/image', ['purpose' => 'business-logo', 'file' => $this->logoOnWhite()], ['Authorization' => "Bearer {$token}"])
            ->assertOk()->assertJsonPath('data.backgroundRemoved', true)->assertJsonPath('data.method', 'basic');
    }

    public function test_keeping_the_background_never_calls_the_ai(): void
    {
        $this->fakeGemini();
        $token = $this->token($this->user('BUSINESS_OWNER'));
        $this->post('/api/v1/uploads/image', ['purpose' => 'business-logo', 'removeBackground' => '0', 'file' => $this->logoOnWhite()], ['Authorization' => "Bearer {$token}"])
            ->assertOk()->assertJsonPath('data.method', 'none');
        Http::assertNothingSent();
    }
}
