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
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// The visiting card as a PDF, with every action a working link.
class CardPdfTest extends TestCase
{
    use RefreshDatabase;

    private Business $business;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.disks.spaces.url' => 'https://cdn.example.test', 'app.url' => 'https://markkito.test']);
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);
        StarterTemplates::install();
        $this->owner = User::create([
            'email' => 'owner-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'O', 'lastName' => 'W', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER',
        ]);
        $this->business = Business::create([
            'ownerId' => $this->owner->id, 'name' => 'Spice Garden', 'slug' => 'spice-garden', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '98765 43210', 'whatsappNumber' => '91234 56789', 'email' => 'hi@spice.test',
            'website' => 'https://spice.test', 'addressLine1' => '1 Main St', 'city' => 'Kochi', 'state' => 'KL',
            'latitude' => 9.9, 'longitude' => 76.2, 'description' => 'Kerala meals and seafood.',
            'instagramUsername' => 'spicegarden', 'facebookPageUrl' => 'https://facebook.com/spicegarden',
            'logoUrl' => 'https://cdn.example.test/logo.png', 'coverImageUrl' => 'https://evil.example.com/cover.jpg',
        ]);
        $img = imagecreatetruecolor(200, 120);
        imagefill($img, 0, 0, imagecolorallocate($img, 200, 80, 30));
        ob_start();
        imagepng($img);
        $png = ob_get_clean();
        Http::fake(['cdn.example.test/*' => Http::response($png, 200, ['Content-Type' => 'image/png'])]);
    }

    private function publish(): void
    {
        BusinessCard::updateOrCreate(['businessId' => $this->business->id], ['isPublished' => true, 'publishedAt' => now(), 'backgroundImageUrl' => 'https://cdn.example.test/bg.png']);
    }

    private function links(string $pdf): array
    {
        preg_match_all('#/URI \((.*?)\)#', $pdf, $m);

        return array_map(fn ($u) => stripslashes($u), $m[1]);
    }

    public function test_the_public_pdf_has_every_action_as_a_working_link(): void
    {
        $this->publish();
        $res = $this->get('/card/spice-garden.pdf')->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Content-Disposition', 'attachment; filename="spice-garden-visiting-card.pdf"');
        $pdf = $res->getContent();
        $this->assertStringStartsWith('%PDF-', $pdf);
        if ($dump = getenv('CARD_PDF_DUMP')) {
            file_put_contents($dump, $pdf);
        }

        $links = $this->links($pdf);
        foreach ([
            'tel:9876543210',
            'https://wa.me/919123456789',
            'https://www.google.com/maps/search/?api=1&query=Spice%20Garden%2C%201%20Main%20St%2C%20Kochi%2C%20KL',
            'mailto:hi@spice.test',
            'https://spice.test',
            'https://instagram.com/spicegarden',
            'https://facebook.com/spicegarden',
            'https://markkito.test/card/spice-garden',
            'https://markkito.test/card/spice-garden.vcf',
        ] as $expected) {
            $this->assertContains($expected, $links, "missing link {$expected}");
        }
        // Only the app's own storage is read: the logo was fetched, the foreign cover image never was.
        Http::assertSent(fn ($r) => $r->url() === 'https://cdn.example.test/logo.png');
        Http::assertNotSent(fn ($r) => str_contains($r->url(), 'evil.example.com'));
    }

    public function test_every_layout_renders(): void
    {
        $this->publish();
        foreach (CardTemplate::where('categoryId', $this->business->categoryId)->get() as $template) {
            $this->business->card()->update(['templateId' => $template->id]);
            $pdf = $this->get('/card/spice-garden.pdf')->assertOk()->getContent();
            $this->assertStringStartsWith('%PDF-', $pdf, $template->name);
            if ($dir = getenv('CARD_PDF_DIR')) {
                file_put_contents("{$dir}/{$template->layout}.pdf", $pdf);
            }
            $this->assertContains('tel:9876543210', $this->links($pdf), $template->name);
        }
    }

    public function test_the_public_pdf_needs_a_live_card_but_the_owner_can_download_it_before(): void
    {
        $this->get('/card/spice-garden.pdf')->assertNotFound();

        $this->withoutVite();
        $this->post('/login', ['email' => $this->owner->email, 'password' => 'Password123!']);
        $pdf = $this->get("/dashboard/businesses/{$this->business->id}/card.pdf?inline=1")->assertOk()
            ->assertHeader('Content-Disposition', 'inline; filename="spice-garden-visiting-card.pdf"')->getContent();
        $links = $this->links($pdf);
        $this->assertContains('tel:9876543210', $links);
        // Not live yet: no links to an online card that would not open.
        $this->assertNotContains('https://markkito.test/card/spice-garden', $links);

        $this->get("/dashboard/businesses/{$this->business->id}?section=".urlencode('Visiting Card'))->assertOk()->assertSee('Download PDF');
    }

    public function test_others_cannot_download_a_business_pdf_from_the_dashboard(): void
    {
        $stranger = User::create([
            'email' => 'x-'.uniqid().'@example.com', 'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'X', 'lastName' => 'Y', 'status' => 'ACTIVE', 'role' => 'BUSINESS_OWNER',
        ]);
        $this->post('/login', ['email' => $stranger->email, 'password' => 'Password123!']);
        $this->get("/dashboard/businesses/{$this->business->id}/card.pdf")->assertForbidden();
    }

    public function test_a_long_card_is_shrunk_to_fit_one_page_and_dark_on_dark_buttons_stay_readable(): void
    {
        $this->publish();
        $this->business->update([
            'description' => str_repeat('Fresh Kerala meals, seafood and snacks made every day. ', 6),
            'addressLine2' => 'Opposite the old bus stand, near the temple road junction',
        ]);
        $this->business->card()->update(['templateId' => CardTemplate::where('name', 'Luxury Dining')->value('id')]);

        $pdf = $this->get('/card/spice-garden.pdf')->assertOk()->getContent();
        $this->assertSame(1, preg_match_all('#/Type\s*/Page[^s]#', $pdf));

        // Luxury Dining: primary #111111 on a #141414 card, so its outline buttons use the gold accent.
        $this->assertSame('#d4af37', \App\Support\Cards\CardEngine::readableOn('#111111', '#141414', ['#d4af37', '#f5f5f4']));
        $this->assertStringContainsString('--ink:#d4af37', $this->get('/card/spice-garden')->getContent());
        $this->assertSame('#1d4ed8', \App\Support\Cards\CardEngine::readableOn('#1d4ed8', '#ffffff', ['#f59e0b']));
    }
}
