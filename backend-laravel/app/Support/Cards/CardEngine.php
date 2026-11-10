<?php

namespace App\Support\Cards;

use App\Models\Business;
use App\Models\BusinessCard;
use App\Models\Category;
use App\Models\CardTemplate;
use App\Support\ReviewChannels;
use App\Support\SiteBuilder\Helpers;
use Illuminate\Support\Collection;

/**
 * The digital-visiting-card template engine.
 *
 * A card is two independent halves put together at render time:
 *   - the design: a CardTemplate row (layout + design tokens), and
 *   - the details: read live from the Business row (details()).
 * Nothing about the business is copied into the template or the card row,
 * so switching designs changes only the look, and editing the listing's
 * phone, logo or address shows up on the card straight away.
 *
 * Every design value an admin can set is checked against the lists below
 * (normalizeDesign()), so the rendered CSS only ever holds known fonts,
 * #rrggbb colours and fixed keywords.
 */
class CardEngine
{
    // Each layout is a Blade partial in resources/views/cards/layouts.
    public const LAYOUTS = [
        'classic' => 'Classic — logo and name over a banner',
        'banner' => 'Banner — full photo header with the name on it',
        'split' => 'Split — colour panel beside the details',
        'luxury' => 'Luxury — framed, centred, ornamental',
        'minimal' => 'Minimal — clean and left aligned',
    ];

    public const BUTTON_STYLES = [
        'rounded' => 'Rounded',
        'pill' => 'Pill',
        'square' => 'Square',
        'outline' => 'Outline',
        'soft' => 'Soft tint',
    ];

    // Google Fonts the cards may use; anything else is replaced by the default.
    public const FONTS = [
        'Inter', 'Poppins', 'Montserrat', 'Roboto', 'Open Sans', 'Nunito', 'DM Sans', 'Raleway',
        'Josefin Sans', 'Space Grotesk', 'Oswald', 'Orbitron', 'Playfair Display', 'Cormorant Garamond',
        'Lora', 'Merriweather', 'Cinzel', 'Great Vibes',
    ];

    public const COLOR_KEYS = ['primary', 'accent', 'background', 'surface', 'text', 'muted', 'buttonText'];

    // How many designs a business is offered at least (topped up with the
    // general templates when its category has fewer of its own).
    public const MIN_CHOICES = 5;

    public static function defaultDesign(): array
    {
        return [
            'colors' => [
                'primary' => '#1d4ed8', 'accent' => '#f59e0b', 'background' => '#eef2ff',
                'surface' => '#ffffff', 'text' => '#0f172a', 'muted' => '#64748b', 'buttonText' => '#ffffff',
            ],
            'fonts' => ['heading' => 'Poppins', 'body' => 'Inter'],
            'buttonStyle' => 'rounded',
            // How much the background photo is darkened (0–0.9), so text on it stays readable.
            'overlay' => 0.35,
        ];
    }

    /** Fills gaps from the defaults and drops anything not on the allow-lists. */
    public static function normalizeDesign(?array $design): array
    {
        $default = self::defaultDesign();
        $design ??= [];
        $colors = [];
        foreach (self::COLOR_KEYS as $key) {
            $value = $design['colors'][$key] ?? null;
            $colors[$key] = is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/', $value) ? strtolower($value) : $default['colors'][$key];
        }
        $font = fn ($value, $fallback) => in_array($value, self::FONTS, true) ? $value : $fallback;
        $overlay = is_numeric($design['overlay'] ?? null) ? (float) $design['overlay'] : $default['overlay'];

        return [
            'colors' => $colors,
            'fonts' => [
                'heading' => $font($design['fonts']['heading'] ?? null, $default['fonts']['heading']),
                'body' => $font($design['fonts']['body'] ?? null, $default['fonts']['body']),
            ],
            'buttonStyle' => array_key_exists($design['buttonStyle'] ?? '', self::BUTTON_STYLES) ? $design['buttonStyle'] : $default['buttonStyle'],
            'overlay' => round(max(0, min(0.9, $overlay)), 2),
        ];
    }

    /** Validation rules for a design payload (admin create/update/preview). */
    public static function designRules(string $prefix = 'design'): array
    {
        $rules = [
            $prefix => ['sometimes', 'array'],
            "{$prefix}.fonts.heading" => ['sometimes', 'in:'.implode(',', self::FONTS)],
            "{$prefix}.fonts.body" => ['sometimes', 'in:'.implode(',', self::FONTS)],
            "{$prefix}.buttonStyle" => ['sometimes', 'in:'.implode(',', array_keys(self::BUTTON_STYLES))],
            "{$prefix}.overlay" => ['sometimes', 'numeric', 'min:0', 'max:0.9'],
        ];
        foreach (self::COLOR_KEYS as $key) {
            $rules["{$prefix}.colors.{$key}"] = ['sometimes', 'regex:/^#[0-9a-fA-F]{6}$/'];
        }

        return $rules;
    }

    public static function fontUrl(array $design): string
    {
        $families = collect([$design['fonts']['heading'], $design['fonts']['body']])->unique()
            ->map(fn ($f) => 'family='.str_replace(' ', '+', $f).':wght@400;500;600;700')
            ->implode('&');

        return "https://fonts.googleapis.com/css2?{$families}&display=swap";
    }

    // --- Which templates a business is offered ------------------------------

    /**
     * The active designs for a category, its default first: its own (and its
     * parent category's), then the common ones (offered to every category),
     * topped up to MIN_CHOICES with the general ones.
     *
     * @return Collection<int, CardTemplate>
     */
    public static function templatesFor(?string $categoryId): Collection
    {
        $ids = [];
        if ($categoryId && ($category = Category::find($categoryId))) {
            $ids = array_filter([$category->id, $category->parentId]);
        }
        $order = fn ($q) => $q->orderByDesc('isDefault')->orderBy('sortOrder')->orderBy('name');

        $own = $ids ? $order(CardTemplate::where('isActive', true)->whereIn('categoryId', $ids))->get() : collect();
        // The category's own default leads, ahead of its parent's.
        $own = $own->sortBy(fn ($t) => [$t->isDefault && $t->categoryId === $categoryId ? 0 : 1, $t->categoryId === $categoryId ? 0 : 1, $t->sortOrder])->values();
        // Common designs: in every category, always.
        $own = $own->concat($order(CardTemplate::where('isActive', true)->where('isCommon', true))->get())->values();
        if ($own->count() >= self::MIN_CHOICES) {
            return $own;
        }
        $general = $order(CardTemplate::where('isActive', true)->whereNull('categoryId')->where('isCommon', false))
            ->limit(self::MIN_CHOICES - $own->count())->get();

        return $own->concat($general)->values();
    }

    public static function defaultFor(?string $categoryId): ?CardTemplate
    {
        return self::templatesFor($categoryId)->first();
    }

    /** The design a business's card wears: its pick while that is active, else the default. */
    public static function templateFor(Business $business, ?BusinessCard $card = null): ?CardTemplate
    {
        $card ??= $business->card;
        $chosen = $card?->templateId ? CardTemplate::find($card->templateId) : null;

        return $chosen && $chosen->isActive ? $chosen : self::defaultFor($business->categoryId);
    }

    /** Every design is open to every business (there are no premium designs). */
    public static function canUse(CardTemplate $template, Business $business, ?array $actor = null): bool
    {
        return true;
    }

    /** What the picker and admin list show for a template. */
    public static function summary(CardTemplate $template): array
    {
        return [
            'id' => $template->id,
            'name' => $template->name,
            'slug' => $template->slug,
            'categoryId' => $template->categoryId,
            'categoryName' => $template->category?->name,
            'isCommon' => (bool) $template->isCommon,
            'layout' => $template->layout,
            'backgroundImageUrl' => $template->backgroundImageUrl,
            // An image template: its artwork and the actions placed on it.
            'imageUrl' => $template->imageUrl,
            'imageWidth' => $template->imageWidth,
            'imageHeight' => $template->imageHeight,
            'hotspots' => $template->hotspots ?? [],
            'design' => self::normalizeDesign($template->design),
            'isDefault' => $template->isDefault,
            'isActive' => $template->isActive,
            'isPremium' => $template->isPremium,
            'sortOrder' => $template->sortOrder,
        ];
    }

    // --- The business half -------------------------------------------------

    /** Whether a URL can safely be used as a card image (no quotes or brackets that could break the CSS). */
    public static function isSafeUrl(?string $url): bool
    {
        return self::safeUrl($url) !== null;
    }

    /**
     * The business on Google Maps — its own listing, not a bare pin. With a
     * Google Place ID (set in Reviews & QR) Maps opens that exact place;
     * otherwise it searches the business's name and address. Only with
     * neither an address nor a name does it fall back to the coordinates.
     */
    public static function mapsUrl(Business $business, ?string $address): ?string
    {
        $base = 'https://www.google.com/maps/search/?api=1&query=';
        $hasCoords = $business->latitude !== null && $business->longitude !== null;
        $text = collect([trim((string) $business->name), $address])->filter()->implode(', ');
        $query = $address ? $text : ($hasCoords ? "{$business->latitude},{$business->longitude}" : $text);
        if ($query === '') {
            return null;
        }
        $url = $base.rawurlencode($query);
        if ($placeId = trim((string) $business->googlePlaceId)) {
            // Maps needs a query alongside the Place ID; the name reads best if it ever shows.
            $url = $base.rawurlencode($text ?: $query).'&query_place_id='.rawurlencode($placeId);
        }

        return $url;
    }

    /**
     * The card link for someone who manages the business ("Open card" in
     * the dashboard): it carries a signed, short-lived pass, so the card
     * shows its colour and design bar even where the browser isn't signed
     * in on the card's own address. Shared links never carry it.
     */
    public static function ownerUrl(Business $business, string $userId, int $hours = 12): string
    {
        return self::cardUrl($business->slug).'?owner='.self::ownerToken($business, $userId, $hours);
    }

    public static function ownerToken(Business $business, string $userId, int $hours = 12): string
    {
        $expires = time() + $hours * 3600;
        $payload = rtrim(strtr(base64_encode("{$userId}.{$expires}"), '+/', '-_'), '=');

        return $payload.'.'.self::ownerSignature($business, $userId, $expires);
    }

    /** The user id a pass is for, if it is genuine, unexpired and for this business; else null. */
    public static function ownerFromToken(?string $token, Business $business): ?string
    {
        if (! is_string($token) || ! preg_match('/^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/', $token, $m)) {
            return null;
        }
        $decoded = base64_decode(strtr($m[1], '-_', '+/'), true);
        if ($decoded === false || ! preg_match('/^([A-Za-z0-9-]+)\.(\d+)$/', $decoded, $p)) {
            return null;
        }
        [, $userId, $expires] = $p;
        if ((int) $expires < time() || ! hash_equals(self::ownerSignature($business, $userId, (int) $expires), $m[2])) {
            return null;
        }

        return $userId;
    }

    private static function ownerSignature(Business $business, string $userId, int $expires): string
    {
        return hash_hmac('sha256', "card-owner|{$business->id}|{$userId}|{$expires}", (string) config('app.key'));
    }

    public static function cardUrl(string $slug): string
    {
        return rtrim((string) config('app.url'), '/')."/card/{$slug}";
    }

    public static function digits(?string $value): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $value);
        if ($digits === '') {
            return null;
        }

        // A 10-digit Indian mobile needs the country code for wa.me.
        return strlen($digits) === 10 ? "91{$digits}" : ltrim($digits, '0');
    }

    /**
     * $color, or the first of $fallbacks that reads well on $background
     * (WCAG contrast of at least 2.5): a design whose primary colour is
     * nearly its card colour — black buttons on a black card — would
     * otherwise draw outline buttons and icons nobody can see.
     */
    public static function readableOn(string $color, string $background, array $fallbacks): string
    {
        $luminance = function (string $hex): float {
            $channels = array_map(function ($v) {
                $v /= 255;

                return $v <= 0.03928 ? $v / 12.92 : (($v + 0.055) / 1.055) ** 2.4;
            }, sscanf($hex, '#%02x%02x%02x'));

            return 0.2126 * $channels[0] + 0.7152 * $channels[1] + 0.0722 * $channels[2];
        };
        $contrast = function (string $a, string $b) use ($luminance): float {
            [$hi, $lo] = [max($luminance($a), $luminance($b)), min($luminance($a), $luminance($b))];

            return ($hi + 0.05) / ($lo + 0.05);
        };

        foreach ([$color, ...$fallbacks] as $candidate) {
            if ($contrast($candidate, $background) >= 2.5) {
                return $candidate;
            }
        }

        return end($fallbacks) ?: $color;
    }

    public static function safeUrl(?string $url): ?string
    {
        // No quotes, brackets or spaces: a background URL is printed inside CSS url('…').
        return $url && preg_match('#^https?://[^\s"\'()<>\\\\]+$#i', $url) ? $url : null;
    }

    /**
     * A Facebook page as the listing has it — a full link, a link without
     * https:// (facebook.com/…, www., m., fb.com/…) or just the page name
     * ("spicegarden", "@spicegarden") — as the page's own web address.
     */
    public static function facebookUrl(?string $raw): ?string
    {
        return self::socialUrl($raw, '(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.com|fb\.me)', 'https://www.facebook.com/', '');
    }

    /** A YouTube channel the same way: a link, with or without https://, or "@channel" / "channel". */
    public static function youtubeUrl(?string $raw): ?string
    {
        return self::socialUrl($raw, '(?:www\.|m\.)?(?:youtube\.com|youtu\.be)', 'https://www.youtube.com/', '@');
    }

    private static function socialUrl(?string $raw, string $hosts, string $home, string $namePrefix): ?string
    {
        $raw = trim((string) $raw);
        if ($raw === '') {
            return null;
        }
        if (preg_match('#^https?://#i', $raw)) {
            return self::safeUrl($raw);
        }
        // A link typed without https://
        if (preg_match('#^'.$hosts.'(/.*)?$#i', $raw)) {
            return self::safeUrl('https://'.$raw);
        }
        // Just the page or channel name.
        $name = ltrim($raw, '@/');

        return preg_match('/^[A-Za-z0-9._-]{1,100}$/', $name) ? $home.$namePrefix.$name : null;
    }

    /** Everything a card prints, read from the business. */
    public static function details(Business $business): array
    {
        $business->loadMissing(['category', 'hours' => fn ($q) => $q->orderBy('dayOfWeek')]);
        $address = collect([$business->addressLine1, $business->addressLine2, $business->city, $business->state, $business->postalCode])
            ->filter()->implode(', ');
        $category = $business->category?->name;
        $instagram = $business->instagramUsername ? ltrim(preg_replace('#^https?://(www\.)?instagram\.com/#i', '', $business->instagramUsername), '@/') : null;

        return [
            'name' => $business->name,
            'category' => $category,
            'tagline' => collect([$category, $business->city])->filter()->implode(' · '),
            'description' => $business->description,
            'logoUrl' => self::safeUrl($business->logoUrl),
            // The business's own card background, worn over any template's.
            'cardBackgroundUrl' => self::safeUrl($business->card?->backgroundImageUrl),
            'coverImageUrl' => self::safeUrl($business->coverImageUrl),
            // The business's own picture: its first gallery photo, else its cover — what a card's
            // logo box shows when the business has no logo.
            'photoUrl' => self::safeUrl($business->photos()->orderBy('sortOrder')->value('url'))
                ?? self::safeUrl($business->coverImageUrl),
            'phone' => $business->phone,
            'phoneHref' => $business->phone ? 'tel:'.preg_replace('/[^\d+]/', '', $business->phone) : null,
            'whatsappHref' => ($wa = self::digits($business->whatsappNumber ?: $business->phone)) ? "https://wa.me/{$wa}" : null,
            'email' => $business->email,
            'website' => self::safeUrl($business->website),
            'address' => $address ?: null,
            'mapsHref' => self::mapsUrl($business, $address ?: null),
            // Google's "write a review" page for the business (set in Reviews & QR).
            'googleReviewHref' => self::safeUrl(ReviewChannels::google($business)),
            'hours' => $business->relationLoaded('hours') && $business->hours->isNotEmpty() ? (Helpers::summariseHours($business->hours) ?: null) : null,
            'social' => array_filter([
                'instagram' => $instagram ? "https://instagram.com/{$instagram}" : null,
                'facebook' => self::facebookUrl($business->facebookPageUrl),
                'youtube' => self::youtubeUrl($business->youtubeUrl),
            ]),
            'cardUrl' => self::cardUrl($business->slug),
            'vcfUrl' => self::cardUrl($business->slug).'.vcf',
            // For the editors' previews: the same contact file from the dashboard, before the card is public.
            'previewVcfUrl' => url("/dashboard/businesses/{$business->id}/card.vcf"),
            'pdfUrl' => self::cardUrl($business->slug).'.pdf',
            'initials' => self::initials($business->name),
        ];
    }

    /** Stand-in details for previews before a business exists (admin, the create form). */
    public static function sampleDetails(?string $name = null, ?string $categoryName = null, ?string $logoUrl = null): array
    {
        $name = trim((string) $name) ?: 'Your Business Name';

        return [
            'name' => $name,
            'category' => $categoryName,
            'tagline' => collect([$categoryName ?: 'Your category', 'Your city'])->implode(' · '),
            'description' => 'A short line about what you do and why customers love you.',
            // The logo uploaded on the create form so far, so the previews show it.
            'logoUrl' => self::safeUrl($logoUrl),
            'cardBackgroundUrl' => null,
            'coverImageUrl' => null,
            'phone' => '+91 98765 43210',
            'phoneHref' => '#',
            'whatsappHref' => '#',
            'email' => 'hello@example.com',
            'website' => 'https://example.com',
            'address' => '12 Main Road, Your City, State',
            'mapsHref' => '#',
            'googleReviewHref' => '#',
            'hours' => 'Mon–Sat · 9:00 AM – 9:00 PM',
            'social' => ['instagram' => '#', 'facebook' => '#', 'youtube' => '#'],
            'cardUrl' => '#',
            'vcfUrl' => '#',
            'pdfUrl' => '#',
            'initials' => self::initials($name),
        ];
    }

    private static function initials(string $name): string
    {
        $words = preg_split('/\s+/', trim($name)) ?: [];

        return mb_strtoupper(collect($words)->filter()->take(2)->map(fn ($w) => mb_substr($w, 0, 1))->implode('')) ?: '•';
    }

    // --- Rendering -----------------------------------------------------------

    /**
     * The whole card as a standalone HTML document.
     *
     * @param  array{layout: string, backgroundImageUrl: ?string, design: ?array}|CardTemplate|null  $template
     * @param  bool  $preview  for pickers and editors: links are inert and nothing is counted
     */
    public static function render(CardTemplate|array|null $template, array $details, bool $preview = false): string
    {
        if ($template instanceof CardTemplate) {
            // An image template is its artwork with the actions on it.
            if ($image = ImageCard::fromTemplate($template)) {
                return ImageCard::renderSource($image, $details, $preview);
            }
            $template =['layout' => $template->layout, 'backgroundImageUrl' => $template->backgroundImageUrl, 'design' => $template->design];
        }
        $template ??= ['layout' => 'classic', 'backgroundImageUrl' => null, 'design' => null];
        $layout = array_key_exists($template['layout'] ?? '', self::LAYOUTS) ? $template['layout'] : 'classic';
        $design = self::normalizeDesign($template['design'] ?? null);

        return view('cards.card', [
            'layout' => $layout,
            'design' => $design,
            'background' => ($details['cardBackgroundUrl'] ?? null) ?? self::safeUrl($template['backgroundImageUrl'] ?? null) ?? $details['coverImageUrl'] ?? null,
            'fontUrl' => self::fontUrl($design),
            'b' => $details,
            'preview' => $preview,
        ])->render();
    }

    /** A vCard 3.0 for the card's "Save contact" button. */
    public static function vcard(array $details): string
    {
        $esc = fn (?string $v) => str_replace(["\\", "\n", ',', ';'], ['\\\\', '\\n', '\\,', '\\;'], (string) $v);
        $lines = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:'.$esc($details['name']), 'ORG:'.$esc($details['name'])];
        if ($details['phone']) {
            $lines[] = 'TEL;TYPE=WORK,VOICE:'.$esc($details['phone']);
        }
        if ($details['email']) {
            $lines[] = 'EMAIL;TYPE=WORK:'.$esc($details['email']);
        }
        if ($details['address']) {
            $lines[] = 'ADR;TYPE=WORK:;;'.$esc($details['address']).';;;;';
        }
        if ($details['website']) {
            $lines[] = 'URL:'.$esc($details['website']);
        }
        $lines[] = 'URL;TYPE=CARD:'.$esc($details['cardUrl']);
        if ($details['description']) {
            $lines[] = 'NOTE:'.$esc($details['description']);
        }
        $lines[] = 'END:VCARD';

        return implode("\r\n", $lines)."\r\n";
    }
}
