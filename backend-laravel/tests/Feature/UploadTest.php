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
        $this->assertStringEndsWith('.jpg', $url);

        Storage::disk('spaces')->assertExists(str_replace(Storage::disk('spaces')->url(''), '', $url));
    }

    public function test_rejects_a_file_larger_than_the_5mb_raster_limit(): void
    {
        $owner = $this->user('BUSINESS_OWNER');
        $token = $this->token($owner);

        // fake()->image() lets us request an oversized JPEG directly.
        $big = UploadedFile::fake()->create('huge.jpg', 6 * 1024, 'image/jpeg');

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
