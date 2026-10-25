<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
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
}
