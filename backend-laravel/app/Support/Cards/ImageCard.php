<?php

namespace App\Support\Cards;

use App\Models\Business;
use App\Models\BusinessCard;
use App\Models\CardTemplate;
use Illuminate\Validation\ValidationException;

/**
 * An image card: the business's own card artwork (a JPG it designed) with
 * tappable actions placed on it in the dashboard editor. Each hotspot is a
 * rectangle in percent of the image — so it lands on the same spot at any
 * screen size — plus the action it runs:
 *
 *   ['id' => 'h1', 'action' => 'call', 'x' => 10.5, 'y' => 62, 'w' => 30, 'h' => 8,
 *    'value' => null, 'label' => null, 'style' => 'invisible']
 *
 * An empty value means "use the listing's own detail" (its phone, WhatsApp,
 * address…), so editing the listing keeps the card current. A hotspot whose
 * action has nothing to point at is left off the public card.
 *
 * Besides actions (kind "action": a tap area or a drawn button), a box can
 * show one of the business's details (kind "text": its name, address, phone
 * number… as text in its own font, linked where it makes sense — the phone
 * number calls, the address opens directions) or a picture (kind "image":
 * its logo, or a QR code of the card's link).
 *
 * The image comes from the business's own card when it saved one, else from
 * the template it wears (an admin-made image template) — see source().
 */
class ImageCard
{
    public const MAX_HOTSPOTS = 40;

    /** Points in a picture's drawn shape. */
    public const MAX_SHAPE_POINTS = 120;

    /** A free image's picture is at most this wide/high, in percent of its area (10x). */
    public const FIT_MAX = 1000;

    // A zoomed-out picture: at least this many percent of its area wide and high.
    public const FIT_MIN = 10;

    /**
     * What a box can be: label, icon, kind (action / text / image), what its
     * value means (null = it takes none) and, for a detail that links
     * somewhere, the action whose link it borrows.
     */
    public const ACTIONS = [
        'call' => ['label' => 'Call', 'icon' => 'phone', 'kind' => 'action', 'value' => 'phone'],
        'whatsapp' => ['label' => 'WhatsApp', 'icon' => 'message-square', 'kind' => 'action', 'value' => 'phone'],
        'email' => ['label' => 'Email', 'icon' => 'mail', 'kind' => 'action', 'value' => 'email'],
        'website' => ['label' => 'Website', 'icon' => 'globe', 'kind' => 'action', 'value' => 'url'],
        // "Location": opens the business on Google Maps (key kept as "directions" for saved cards).
        'directions' => ['label' => 'Location', 'icon' => 'map-pin', 'kind' => 'action', 'value' => 'place'],
        // Opens Google's "write a review" page for the business (Social Media), or a link typed on the card.
        'google_review' => ['label' => 'Review us on Google', 'icon' => 'star', 'kind' => 'action', 'value' => 'url'],
        'instagram' => ['label' => 'Instagram', 'icon' => 'instagram', 'kind' => 'action', 'value' => 'url'],
        'facebook' => ['label' => 'Facebook', 'icon' => 'facebook', 'kind' => 'action', 'value' => 'url'],
        'youtube' => ['label' => 'YouTube', 'icon' => 'youtube', 'kind' => 'action', 'value' => 'url'],
        'save_contact' => ['label' => 'Save contact', 'icon' => 'user-plus', 'kind' => 'action', 'value' => null],
        'share' => ['label' => 'Share', 'icon' => 'share-2', 'kind' => 'action', 'value' => null],
        'link' => ['label' => 'Link', 'icon' => 'link-2', 'kind' => 'action', 'value' => 'url'],
        // Business details, shown on the card.
        'name' => ['label' => 'Business name', 'icon' => 'store', 'kind' => 'text', 'value' => 'text'],
        'tagline' => ['label' => 'Category & city', 'icon' => 'briefcase', 'kind' => 'text', 'value' => 'text'],
        'phone_text' => ['label' => 'Phone number', 'icon' => 'smartphone', 'kind' => 'text', 'value' => 'phone', 'link' => 'call'],
        'email_text' => ['label' => 'Email address', 'icon' => 'mail', 'kind' => 'text', 'value' => 'email', 'link' => 'email'],
        'website_text' => ['label' => 'Website address', 'icon' => 'globe', 'kind' => 'text', 'value' => 'url', 'link' => 'website'],
        'address' => ['label' => 'Address', 'icon' => 'map-pin', 'kind' => 'text', 'value' => 'text', 'link' => 'directions'],
        'hours' => ['label' => 'Opening hours', 'icon' => 'clock', 'kind' => 'text', 'value' => 'text'],
        'about' => ['label' => 'About', 'icon' => 'info', 'kind' => 'text', 'value' => 'text'],
        // Free text typed on the card itself — a slogan, an offer, a note — in any font and style.
        'custom_text' => ['label' => 'Custom text', 'icon' => 'pencil', 'kind' => 'text', 'value' => 'text'],
        // A logo's value is an uploaded picture; empty = the listing's logo.
        'logo' => ['label' => 'Logo', 'icon' => 'image', 'kind' => 'image', 'value' => 'image'],
        'qr' => ['label' => 'QR code', 'icon' => 'qr-code', 'kind' => 'image', 'value' => null],
        // A free picture — any photo or graphic, placed and sized freely, in any shape (like Custom text).
        'custom_image' => ['label' => 'Free image', 'icon' => 'image-plus', 'kind' => 'image', 'value' => 'image'],
    ];

    public const ALIGNS = ['left', 'center', 'right'];

    /** invisible: a clear tap area over a button printed in the artwork; icon / button: drawn on top. */
    public const STYLES = ['invisible', 'icon', 'button'];

    // Text style of a drawn action: font size in px at the card's full
    // 480px width (it scales with the card), and the default colours.
    public const DEFAULT_FONT_SIZE = 13;

    private const HEX = '/^#[0-9a-fA-F]{6}$/';

    /**
     * The image a business's card shows, with its actions: the card's own
     * copy, else the image template it wears; null = no image (the card
     * uses its template's layout instead).
     *
     * @return array{imageUrl: string, imageWidth: ?int, imageHeight: ?int, hotspots: array, fromTemplate: bool}|null
     */
    public static function source(Business $business, ?BusinessCard $card = null): ?array
    {
        $card ??= $business->card;
        $template = CardEngine::templateFor($business, $card);
        if ($card?->imageUrl) {
            $source = self::pack($card->imageUrl, $card->imageWidth, $card->imageHeight, $card->hotspots, false);
        } else {
            $source = $template ? self::fromTemplate($template) : null;
        }

        // The business's recolouring applies to whichever image it wears — only in
        // the card's own marked areas, or else the ones marked on its design.
        return $source ? [...$source, 'colour' => self::colourFor($card, $template)] : null;
    }

    /** The card's colour, limited to its own marked areas or else to its design's. */
    public static function colourFor(?BusinessCard $card, ?CardTemplate $template): ?array
    {
        $colour = ImageColour::normalize($card?->imageColour);
        $designAreas = ImageColour::areas($template?->colourAreas ?? null);
        if ($colour && ! $colour['areas'] && $designAreas) {
            $colour['areas'] = $designAreas;
        }

        return $colour;
    }

    /**
     * The ready-made image designs a business can show after its own card in
     * "Multi card view": those offered for its category, minus the one its
     * card already wears.
     *
     * @return \Illuminate\Support\Collection<int, CardTemplate>
     */
    public static function extraDesignOptions(Business $business, ?BusinessCard $card = null): \Illuminate\Support\Collection
    {
        $card ??= $business->card;
        $current = CardEngine::templateFor($business, $card);

        return CardEngine::templatesFor($business->categoryId)
            ->filter(fn (CardTemplate $t) => (bool) $t->imageUrl && $t->id !== $current?->id)
            ->values();
    }

    /**
     * The cards the public link shows: the business's own first ('main'),
     * then — with Multi card view on — the extra designs it picked (all of
     * them when it picked none), each drawn with the business's details.
     *
     * @return list<array{id: string, name: string, template: ?CardTemplate}>
     */
    public static function slides(Business $business, ?BusinessCard $card = null): array
    {
        $card ??= $business->card;
        $slides = [['id' => 'main', 'name' => $business->name, 'template' => null]];
        if (! $card?->multiView) {
            return $slides;
        }
        $options = self::extraDesignOptions($business, $card);
        $picked = $card->extraTemplateIds;
        if (is_array($picked) && $picked) {
            $options = $options->filter(fn (CardTemplate $t) => in_array($t->id, $picked, true));
        }
        foreach ($options as $t) {
            $slides[] = ['id' => $t->id, 'name' => $t->name, 'template' => $t];
        }

        return $slides;
    }

    /** One of the business's slides as a standalone HTML document; null = no such slide. */
    public static function renderSlide(Business $business, string $id, bool $embedded = false): ?string
    {
        $slide = collect(self::slides($business))->firstWhere('id', $id);
        if (! $slide) {
            return null;
        }
        $details = CardEngine::details($business);
        if (! $slide['template']) {
            $source = self::source($business);

            return $source
                ? self::renderSource($source, $details, false, true, $embedded)
                : CardEngine::render(CardEngine::templateFor($business), $details);
        }

        return self::renderSource(self::fromTemplate($slide['template']), $details, false, true, $embedded);
    }

    public static function fromTemplate(CardTemplate $template): ?array
    {
        return $template->imageUrl
            ? self::pack($template->imageUrl, $template->imageWidth, $template->imageHeight, $template->hotspots, true)
            : null;
    }

    private static function pack(string $url, ?int $w, ?int $h, ?array $hotspots, bool $fromTemplate): array
    {
        return ['imageUrl' => $url, 'imageWidth' => $w, 'imageHeight' => $h, 'hotspots' => $hotspots ?? [], 'fromTemplate' => $fromTemplate];
    }

    public static function rules(): array
    {
        return [
            'hotspots' => ['sometimes', 'array', 'max:'.self::MAX_HOTSPOTS],
            'hotspots.*.id' => ['required', 'string', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/'],
            'hotspots.*.action' => ['required', 'in:'.implode(',', array_keys(self::ACTIONS))],
            'hotspots.*.x' => ['required', 'numeric', 'min:0', 'max:100'],
            'hotspots.*.y' => ['required', 'numeric', 'min:0', 'max:100'],
            'hotspots.*.w' => ['required', 'numeric', 'min:1', 'max:100'],
            'hotspots.*.h' => ['required', 'numeric', 'min:1', 'max:100'],
            'hotspots.*.value' => ['nullable', 'string', 'max:500'],
            'hotspots.*.label' => ['nullable', 'string', 'max:60'],
            'hotspots.*.style' => ['nullable', 'in:'.implode(',', self::STYLES)],
            'hotspots.*.font' => ['nullable', 'in:'.implode(',', CardEngine::FONTS)],
            'hotspots.*.fontSize' => ['nullable', 'integer', 'min:8', 'max:48'],
            'hotspots.*.bold' => ['nullable', 'boolean'],
            'hotspots.*.italic' => ['nullable', 'boolean'],
            'hotspots.*.color' => ['nullable', 'regex:'.self::HEX],
            'hotspots.*.bg' => ['nullable', 'regex:'.self::HEX],
            'hotspots.*.align' => ['nullable', 'in:'.implode(',', self::ALIGNS)],
            'hotspots.*.radius' => ['nullable', 'integer', 'min:0', 'max:50'],
            // A picture cut to a shape: [x, y] points in percent of its box.
            'hotspots.*.shape' => ['nullable', 'array', 'min:3', 'max:'.self::MAX_SHAPE_POINTS],
            'hotspots.*.shapePreset' => ['nullable', 'in:square,round,oval'],
            'hotspots.*.shapeSize' => ['nullable', 'integer', 'min:'.self::SHAPE_MIN_SIZE, 'max:100'],
            'hotspots.*.shape.*' => ['array', 'size:2'],
            'hotspots.*.shape.*.*' => ['numeric', 'min:0', 'max:100'],
            // Where a free image's picture sits inside its area: its rectangle in percent of the area.
            // Zoomed in it covers the area (edges never inside); zoomed out it's smaller and stays within it.
            'hotspots.*.fit' => ['nullable', 'array'],
            'hotspots.*.fit.l' => ['required_with:hotspots.*.fit', 'numeric', 'min:-'.(self::FIT_MAX - 100), 'max:'.(100 - self::FIT_MIN)],
            'hotspots.*.fit.t' => ['required_with:hotspots.*.fit', 'numeric', 'min:-'.(self::FIT_MAX - 100), 'max:'.(100 - self::FIT_MIN)],
            'hotspots.*.fit.w' => ['required_with:hotspots.*.fit', 'numeric', 'min:'.self::FIT_MIN, 'max:'.self::FIT_MAX],
            'hotspots.*.fit.h' => ['required_with:hotspots.*.fit', 'numeric', 'min:'.self::FIT_MIN, 'max:'.self::FIT_MAX],
        ];
    }

    /**
     * Validated hotspots, kept inside the image and with a value that makes
     * sense for the action (a custom link must be a web address, …).
     *
     * $lenient (live previews, while an action is still being typed): a value
     * that isn't valid yet is dropped instead of refusing the whole card.
     */
    public static function normalize(array $hotspots, bool $lenient = false): array
    {
        $out = [];
        foreach (array_values($hotspots) as $i => $h) {
            $w = round(min(100, max(1, (float) $h['w'])), 3);
            $hh = round(min(100, max(1, (float) $h['h'])), 3);
            $value = trim((string) ($h['value'] ?? '')) ?: null;
            $kind = self::ACTIONS[$h['action']]['kind'];
            $spot = [
                'id' => (string) $h['id'],
                'action' => $h['action'],
                'x' => round(min(100 - $w, max(0, (float) $h['x'])), 3),
                'y' => round(min(100 - $hh, max(0, (float) $h['y'])), 3),
                'w' => $w,
                'h' => $hh,
                'value' => self::ACTIONS[$h['action']]['value'] ? $value : null,
                'label' => trim((string) ($h['label'] ?? '')) ?: null,
                // Only actions have a look; details are drawn as text or a picture.
                'style' => $kind !== 'action' ? null : (in_array($h['style'] ?? null, self::STYLES, true) ? $h['style'] : 'invisible'),
                // Text style (used by the drawn styles): only known fonts and #rrggbb colours reach the CSS.
                'font' => in_array($h['font'] ?? null, CardEngine::FONTS, true) ? $h['font'] : null,
                'fontSize' => isset($h['fontSize']) ? (int) min(48, max(8, (int) $h['fontSize'])) : null,
                'bold' => (bool) ($h['bold'] ?? false),
                'italic' => (bool) ($h['italic'] ?? false),
                'color' => isset($h['color']) && preg_match(self::HEX, $h['color']) ? strtolower($h['color']) : null,
                'bg' => isset($h['bg']) && preg_match(self::HEX, $h['bg']) ? strtolower($h['bg']) : null,
                'align' => in_array($h['align'] ?? null, self::ALIGNS, true) ? $h['align'] : null,
                // A picture's rounded corners (logo or free image), in percent of its box: 0 = none, 50 = round.
                'radius' => in_array($h['action'], ['logo', 'custom_image'], true) && ! empty($h['radius']) ? (int) min(50, max(0, (int) $h['radius'])) : null,
                // A picture cut to a shape drawn in the editor (a preset or by hand).
                'shape' => in_array($h['action'], ['logo', 'custom_image'], true) ? self::shape($h['shape'] ?? null) : null,
                // A free image's ready shape (open card) and its size in percent of the box, to adjust it later.
                'shapePreset' => $h['action'] === 'custom_image' && in_array($h['shapePreset'] ?? null, ['square', 'round', 'oval'], true) ? $h['shapePreset'] : null,
                'shapeSize' => $h['action'] === 'custom_image' && isset($h['shapeSize']) && is_numeric($h['shapeSize']) ? (int) min(100, max(self::SHAPE_MIN_SIZE, (int) $h['shapeSize'])) : null,
                // Where the picture sits in its box (moved and zoomed): a free image or the logo.
                'fit' => in_array($h['action'], ['logo', 'custom_image'], true) ? self::fit($h['fit'] ?? null) : null,
            ];
            if ($lenient) {
                if (! self::valueIsValid($spot)) {
                    $spot['value'] = null;
                }
                $out[] = $spot;

                continue;
            }
            if (! self::valueIsValid($spot)) {
                throw ValidationException::withMessages(["hotspots.{$i}.value" => self::invalidValueMessage($spot['action'])]);
            }
            if ($spot['action'] === 'link' && $spot['value'] === null) {
                throw ValidationException::withMessages(["hotspots.{$i}.value" => 'A custom link needs a web address (https://…).']);
            }
            $out[] = $spot;
        }

        return $out;
    }

    /** A drawn shape as [[x, y], …] in percent of the box, each 0–100; null = none (fewer than 3 points). */
    public static function shape(mixed $points): ?array
    {
        if (! is_array($points)) {
            return null;
        }
        $out = [];
        foreach (array_slice(array_values($points), 0, self::MAX_SHAPE_POINTS) as $p) {
            if (is_array($p) && count($p) === 2 && is_numeric($p[0] ?? null) && is_numeric($p[1] ?? null)) {
                $out[] = [round(min(100, max(0, (float) $p[0])), 1), round(min(100, max(0, (float) $p[1])), 1)];
            }
        }

        return count($out) >= 3 ? $out : null;
    }

    /**
     * A new design's boxes with what was put on the old design carried over:
     * each empty box of the new design takes the value (an uploaded picture,
     * a logo, a typed phone number, link or text) of an old box of the same
     * kind — the same id first, then the same name, then the next in order.
     * A box the new design fills itself keeps its own. The pictures start
     * fitting their new boxes (their old zoom and position belonged to the
     * old box); the new design's shapes stay.
     *
     * @return array{0: array, 1: int} the new boxes, and how many were filled
     */
    public static function carryOver(array $old, array $new): array
    {
        $pool = [];
        foreach ($old as $h) {
            $action = $h['action'] ?? null;
            if ($action && (self::ACTIONS[$action]['value'] ?? null) !== null && isset($h['value']) && trim((string) $h['value']) !== '') {
                $pool[$action][] = $h;
            }
        }
        $filled = 0;
        foreach ($new as &$h) {
            $action = $h['action'] ?? null;
            if (! $action || empty($pool[$action]) || (isset($h['value']) && trim((string) $h['value']) !== '')) {
                continue;
            }
            $pick = null;
            foreach (['id', 'label'] as $key) {
                foreach ($pool[$action] as $i => $o) {
                    if ($pick === null && ! empty($h[$key]) && ($o[$key] ?? null) === $h[$key]) {
                        $pick = $i;
                    }
                }
            }
            $pick ??= array_key_first($pool[$action]);
            $h['value'] = $pool[$action][$pick]['value'];
            $h['fit'] = null;
            unset($pool[$action][$pick]);
            $filled++;
        }
        unset($h);

        return [$new, $filled];
    }

    /**
     * Whether a card's own copy is still a design as made — the same image and
     * the same boxes in the same places — with only what's in them changed
     * (pictures, values, zoom, shape). Then the design counts as "in use".
     */
    public static function wears(?BusinessCard $card, CardTemplate $template): bool
    {
        if (! $card?->imageUrl) {
            return true;
        }
        if ($card->imageUrl !== $template->imageUrl) {
            return false;
        }
        $layout = fn ($spots) => collect($spots ?? [])->map(fn ($h) => [$h['id'] ?? null, $h['action'] ?? null, (float) ($h['x'] ?? 0), (float) ($h['y'] ?? 0), (float) ($h['w'] ?? 0), (float) ($h['h'] ?? 0)])->sortBy(0)->values()->all();

        return $layout($card->hotspots) == $layout($template->hotspots);
    }

    // The ready shapes a free image can be cut to from the open card, and how small one can be (percent of its box).
    public const SHAPE_PRESETS = ['normal', 'square', 'round', 'oval'];

    public const SHAPE_MIN_SIZE = 20;

    /**
     * A ready shape as outline points in percent of the box: "square" and
     * "round" are the biggest square / circle that fit the box, centred
     * (so they need the box's real proportions: its w/h in percent of the
     * card image, $cardW × $cardH px); "oval" fills the box; "normal" = none.
     */
    public static function presetShape(string $preset, array $spot, ?int $cardW, ?int $cardH, int $size = 100): ?array
    {
        // Smaller than the box: scaled about its centre.
        $k = min(100, max(self::SHAPE_MIN_SIZE, $size)) / 100;
        $boxW = (float) ($spot['w'] ?? 0) * (int) $cardW;
        $boxH = (float) ($spot['h'] ?? 0) * (int) $cardH;
        // Unknown proportions: treat the box as square.
        [$sx, $sy] = $boxW > 0 && $boxH > 0 ? [min(1, $boxH / $boxW) * $k, min(1, $boxW / $boxH) * $k] : [$k, $k];
        $ring = fn (float $rx, float $ry) => array_map(
            fn ($i) => [50 + $rx * cos(2 * M_PI * $i / 64), 50 + $ry * sin(2 * M_PI * $i / 64)],
            range(0, 63),
        );

        return self::shape(match ($preset) {
            'square' => [[50 - 50 * $sx, 50 - 50 * $sy], [50 + 50 * $sx, 50 - 50 * $sy], [50 + 50 * $sx, 50 + 50 * $sy], [50 - 50 * $sx, 50 + 50 * $sy]],
            'round' => $ring(50 * $sx, 50 * $sy),
            'oval' => $ring(50 * $k, 50 * $k),
            default => null,
        });
    }

    /** The card's spots with one free image cut to a ready shape (rounded corners dropped); null = no such box. */
    public static function withSpotShape(array $hotspots, string $spotId, string $preset, ?int $cardW, ?int $cardH, int $size = 100): ?array
    {
        $found = false;
        foreach ($hotspots as &$h) {
            if (($h['id'] ?? null) === $spotId && ($h['action'] ?? null) === 'custom_image') {
                $h['shape'] = self::presetShape($preset, $h, $cardW, $cardH, $size);
                $h['shapePreset'] = $preset === 'normal' ? null : $preset;
                $h['shapeSize'] = $preset === 'normal' ? null : min(100, max(self::SHAPE_MIN_SIZE, $size));
                $h['radius'] = null;
                $found = true;
            }
        }
        unset($h);

        return $found ? $hotspots : null;
    }

    /**
     * A picture fitted to fill its whole box ("full size"): kept in its own
     * proportions, centred, and just big enough that no edge shows — what a
     * newly uploaded picture starts as. $spot's w/h are its box in percent of
     * the card image ($cardW × $cardH px); null when a size is unknown.
     */
    public static function coverFit(array $spot, ?int $cardW, ?int $cardH, int $picW, int $picH): ?array
    {
        $boxW = (float) ($spot['w'] ?? 0) * (int) $cardW;
        $boxH = (float) ($spot['h'] ?? 0) * (int) $cardH;
        if ($boxW <= 0 || $boxH <= 0 || $picW <= 0 || $picH <= 0) {
            return null;
        }
        $over = ($picW / $picH) / ($boxW / $boxH); // >1: wider than the box
        [$w, $h] = $over >= 1 ? [100 * $over, 100.0] : [100.0, 100 / $over];

        return self::fit(['l' => (100 - $w) / 2, 't' => (100 - $h) / 2, 'w' => $w, 'h' => $h]);
    }

    /**
     * Where a free image's picture sits inside its area: its rectangle
     * ['l', 't', 'w', 'h'] in percent of the area, always covering it.
     * null = centred, just covering (object-fit: cover).
     */
    public static function fit(mixed $fit): ?array
    {
        if (! is_array($fit) || ! isset($fit['l'], $fit['t'], $fit['w'], $fit['h'])) {
            return null;
        }
        $w = round(min(self::FIT_MAX, max(self::FIT_MIN, (float) $fit['w'])), 2);
        $h = round(min(self::FIT_MAX, max(self::FIT_MIN, (float) $fit['h'])), 2);
        // Bigger than the area: its edges never come inside. Smaller: it stays within the area.
        $place = fn (float $v, float $size) => $size >= 100 ? min(0, max(100 - $size, $v)) : min(100 - $size, max(0, $v));

        return [
            'l' => round($place((float) $fit['l'], $w), 2),
            't' => round($place((float) $fit['t'], $h), 2),
            'w' => $w,
            'h' => $h,
        ];
    }

    /**
     * How a picture box is drawn on the public card: the CSS for the box
     * (its shape or rounded corners) and for the picture in it (cover,
     * moved and zoomed, for a free image). Only numbers reach the CSS.
     *
     * @return array{box: string, img: ?string}
     */
    public static function pictureCss(array $s): array
    {
        $shape = ! empty($s['shape']) ? self::clipPath($s['shape']) : null;
        $radius = (int) ($s['radius'] ?? 0);
        $box = $shape ? 'border-radius:0;clip-path:'.$shape : ($radius ? "border-radius:{$radius}%" : (($s['action'] ?? '') === 'custom_image' ? 'border-radius:0' : ''));
        $f = in_array($s['action'] ?? '', ['logo', 'custom_image'], true) ? self::fit($s['fit'] ?? null) : null;
        if ($f) {
            $img = sprintf('position:absolute;left:%s%%;top:%s%%;width:%s%%;height:%s%%;max-width:none;object-fit:cover', $f['l'], $f['t'], $f['w'], $f['h']);
        } elseif (($s['action'] ?? '') === 'custom_image') {
            // A free image with no position of its own fills its whole box (auto fit), centred.
            $img = 'object-fit:cover';
        } else {
            $img = $shape ? 'object-fit:cover' : ($radius ? "object-fit:cover;border-radius:{$radius}%" : null);
        }

        return ['box' => $box, 'img' => $img];
    }

    /** A drawn shape as a CSS clip-path (only numbers reach the CSS). */
    public static function clipPath(array $shape): string
    {
        return 'polygon('.implode(',', array_map(fn ($p) => ((float) $p[0]).'% '.((float) $p[1]).'%', $shape)).')';
    }

    /** Whether a box's own value suits it: a real phone number, email, web address… (free text always does). */
    private static function valueIsValid(array $spot): bool
    {
        if ($spot['value'] === null || self::ACTIONS[$spot['action']]['value'] === 'text') {
            return true;
        }
        if (self::ACTIONS[$spot['action']]['value'] === 'image') {
            return CardEngine::safeUrl($spot['value']) !== null;
        }
        $linkAs = self::ACTIONS[$spot['action']]['link'] ?? $spot['action'];

        return self::href(['action' => $linkAs, 'value' => $spot['value']], []) !== null;
    }

    private static function invalidValueMessage(string $action): string
    {
        return match (self::ACTIONS[$action]['value']) {
            'phone' => 'Enter a phone number with at least 6 digits.',
            'image' => $action === 'logo' ? 'Upload the logo again.' : 'Upload the picture again.',
            'email' => 'Enter a valid email address.',
            default => 'Enter a full web address starting with https://',
        };
    }

    /** Where a hotspot leads, from its own value or else the listing's details; null = nowhere. */
    public static function href(array $spot, array $details): ?string
    {
        $value = $spot['value'] ?? null;
        // A detail shown as text links like its action: the phone number calls, the address opens directions.
        if ($linkAs = self::ACTIONS[$spot['action']]['link'] ?? null) {
            return $spot['action'] === 'address' && $value !== null
                ? 'https://www.google.com/maps/search/?api=1&query='.rawurlencode($value)
                : self::href(['action' => $linkAs, 'value' => $value], $details);
        }

        return match ($spot['action']) {
            'call' => $value !== null
                ? (strlen(preg_replace('/\D+/', '', $value)) >= 6 ? 'tel:'.preg_replace('/[^\d+]/', '', $value) : null)
                : ($details['phoneHref'] ?? null),
            'whatsapp' => $value !== null
                ? (($d = CardEngine::digits($value)) && strlen($d) >= 6 ? "https://wa.me/{$d}" : null)
                : ($details['whatsappHref'] ?? null),
            'email' => $value !== null
                ? (filter_var($value, FILTER_VALIDATE_EMAIL) ? 'mailto:'.$value : null)
                : (! empty($details['email']) ? 'mailto:'.$details['email'] : null),
            'website', 'link' => $value !== null ? CardEngine::safeUrl($value) : ($spot['action'] === 'website' ? ($details['website'] ?? null) : null),
            'directions' => $value !== null
                ? (CardEngine::safeUrl($value) ?? (preg_match('#^[a-z]+:#i', $value) ? null : 'https://www.google.com/maps/search/?api=1&query='.rawurlencode($value)))
                : ($details['mapsHref'] ?? null),
            'instagram' => $value !== null
                ? (CardEngine::safeUrl($value) ?? (preg_match('/^@?[A-Za-z0-9._]{1,30}$/', $value) ? 'https://instagram.com/'.ltrim($value, '@') : null))
                : ($details['social']['instagram'] ?? null),
            // Its own address may be typed like the listing's: a link, with or without https://, or the page name.
            'facebook' => $value !== null ? CardEngine::facebookUrl($value) : ($details['social']['facebook'] ?? null),
            'youtube' => $value !== null ? CardEngine::youtubeUrl($value) : ($details['social']['youtube'] ?? null),
            'google_review' => $value !== null ? CardEngine::safeUrl($value) : ($details['googleReviewHref'] ?? null),
            'save_contact' => $details['vcfUrl'] ?? '#',
            'share' => '#',
            default => null,
        };
    }

    /** What a text detail shows: its own text, else the listing's. */
    public static function display(array $spot, array $details): ?string
    {
        $own = $spot['value'] ?? null;
        $text = $own ?? match ($spot['action']) {
            'name' => $details['name'] ?? null,
            'tagline' => $details['tagline'] ?? null,
            'phone_text' => $details['phone'] ?? null,
            'email_text' => $details['email'] ?? null,
            'website_text' => isset($details['website']) ? preg_replace('#^https?://(www\.)?#i', '', rtrim($details['website'], '/')) : null,
            'address' => $details['address'] ?? null,
            'hours' => $details['hours'] ?? null,
            'about' => $details['description'] ?? null,
            default => null,
        };

        return $text !== null && trim($text) !== '' ? $text : null;
    }

    /** The business's picture for a logo box: its logo, else its own photo (gallery or cover). */
    private static function businessImage(array $details): ?string
    {
        return CardEngine::safeUrl($details['logoUrl'] ?? null) ?? CardEngine::safeUrl($details['photoUrl'] ?? null);
    }

    /** What a picture box shows: the business's logo, or a QR code of its card's link. */
    public static function picture(array $spot, array $details): ?string
    {
        return match ($spot['action']) {
            // An uploaded picture, else the listing's logo, else the business's own photo.
            'logo' => CardEngine::safeUrl($spot['value'] ?? null) ?? self::businessImage($details),
            'custom_image' => CardEngine::safeUrl($spot['value'] ?? null),
            'qr' => CardPdf::qr(($details['cardUrl'] ?? '#') !== '#' ? $details['cardUrl'] : rtrim((string) config('app.url'), '/').'/card/your-business'),
            default => null,
        };
    }

    /** What an empty value falls back to, per box — shown in the editor. */
    public static function listingDefaults(array $details): array
    {
        $texts = [];
        foreach (self::ACTIONS as $key => $a) {
            if ($a['kind'] === 'text') {
                $texts[$key] = self::display(['action' => $key], $details);
            }
        }

        return $texts + [
            'logo' => self::businessImage($details),
            'call' => $details['phone'] ?? null,
            'whatsapp' => str_starts_with((string) ($details['whatsappHref'] ?? ''), 'https://wa.me/') ? '+'.substr($details['whatsappHref'], strlen('https://wa.me/')) : null,
            'email' => $details['email'] ?? null,
            'website' => $details['website'] ?? null,
            'directions' => $details['address'] ?? null,
            'instagram' => $details['social']['instagram'] ?? null,
            'facebook' => $details['social']['facebook'] ?? null,
            'youtube' => $details['social']['youtube'] ?? null,
            'google_review' => $details['googleReviewHref'] ?? null,
        ];
    }

    // Where each listing detail a card box can show is filled in on the
    // business's Manage page: [what it is, the section].
    private const DETAIL_SOURCES = [
        'call' => ['Phone number', 'Contact'],
        'phone_text' => ['Phone number', 'Contact'],
        'whatsapp' => ['WhatsApp number', 'Contact'],
        'email' => ['Email address', 'Contact'],
        'email_text' => ['Email address', 'Contact'],
        'website' => ['Website', 'Contact'],
        'website_text' => ['Website', 'Contact'],
        'directions' => ['Address', 'Contact'],
        'address' => ['Address', 'Contact'],
        'name' => ['Business name', 'Contact'],
        'tagline' => ['Category & city', 'Contact'],
        'about' => ['Description', 'Contact'],
        'logo' => ['Logo', 'Contact'],
        'hours' => ['Opening hours', 'Hours'],
        'instagram' => ['Instagram', 'Social Media'],
        'facebook' => ['Facebook page', 'Social Media'],
        'youtube' => ['YouTube channel', 'Social Media'],
        'google_review' => ['Google review link', 'Social Media'],
    ];

    // The missing details that can be typed in right on the Visiting Card
    // section: [the field, the endpoint that saves it (the listing itself, or
    // its review/social links), the input type (or "image": an upload, or
    // "textarea"), a placeholder]. Only opening hours — a whole week — keeps
    // its link to the section that edits it.
    public const DETAIL_INPUTS = [
        'logo' => ['logoUrl', 'business', 'image', 'https://…/logo.png or upload'],
        'name' => ['name', 'business', 'text', 'Your business name'],
        // Picked from drop-downs: the category, and the state and city (area).
        'tagline' => ['categoryId', 'business', 'category-city', 'Select category'],
        'directions' => ['addressLine1', 'business', 'text', 'Shop no., street, area'],
        'address' => ['addressLine1', 'business', 'text', 'Shop no., street, area'],
        'call' => ['phone', 'business', 'tel', 'e.g. 98765 43210'],
        'phone_text' => ['phone', 'business', 'tel', 'e.g. 98765 43210'],
        'whatsapp' => ['whatsappNumber', 'business', 'tel', 'e.g. 98765 43210'],
        'email' => ['email', 'business', 'email', 'you@yourshop.com'],
        'email_text' => ['email', 'business', 'email', 'you@yourshop.com'],
        'website' => ['website', 'business', 'url', 'https://…'],
        'website_text' => ['website', 'business', 'url', 'https://…'],
        'about' => ['description', 'business', 'textarea', 'A short line about what you do'],
        'instagram' => ['instagramUsername', 'links', 'text', '@yourshop'],
        'facebook' => ['facebookPageUrl', 'links', 'text', 'yourshop or https://facebook.com/yourshop'],
        'youtube' => ['youtubeUrl', 'links', 'text', '@yourshop or a full YouTube link'],
        'google_review' => ['googleReviewUrl', 'links', 'url', 'Google Maps share link (maps.app.goo.gl/…)'],
    ];

    /**
     * The listing details the card's boxes need but the listing lacks — each
     * once, with the Manage section where it's added. A box with its own
     * value (set on the card or its design) needs nothing.
     *
     * @return list<array{key: string, label: string, section: string}>
     */
    public static function missingDetails(array $hotspots, array $defaults): array
    {
        $missing = [];
        foreach ($hotspots as $h) {
            $action = $h['action'] ?? null;
            // A free image has no listing detail behind it: its picture is uploaded onto that spot.
            if ($action === 'custom_image' && empty($h['value']) && ! empty($h['id'])) {
                $missing['spot:'.$h['id']] = ['key' => 'custom_image', 'spot' => (string) $h['id'], 'label' => ($h['label'] ?? null) ?: 'Free image', 'section' => 'Visiting Card'];

                continue;
            }
            if (! isset(self::DETAIL_SOURCES[$action]) || ! empty($h['value']) || ! empty($defaults[$action])) {
                continue;
            }
            [$label, $section] = self::DETAIL_SOURCES[$action];
            $missing[$label] ??= ['key' => $action, 'label' => $label, 'section' => $section];
        }

        return array_values($missing);
    }

    /**
     * Every detail the card's boxes show from the listing (plus its free
     * images), each once, with its current value — to update right on the
     * Visiting Card section. The missing ones come first. A box whose value
     * is set on the design itself isn't a listing detail and isn't listed.
     *
     * @return list<array{key: string, label: string, section: string, value: ?string, missing: bool, spot?: string}>
     */
    public static function cardDetails(array $hotspots, array $defaults, Business $business): array
    {
        $out = [];
        foreach ($hotspots as $h) {
            $action = $h['action'] ?? null;
            if ($action === 'custom_image' && ! empty($h['id'])) {
                $out['spot:'.$h['id']] = [
                    'key' => 'custom_image', 'spot' => (string) $h['id'], 'label' => ($h['label'] ?? null) ?: 'Free image',
                    'section' => 'Visiting Card', 'value' => ($h['value'] ?? null) ?: null, 'missing' => empty($h['value']),
                ];

                continue;
            }
            if (! isset(self::DETAIL_SOURCES[$action]) || ! empty($h['value'])) {
                continue;
            }
            [$label, $section] = self::DETAIL_SOURCES[$action];
            // Category & city is picked from drop-downs; its value is the text the card shows.
            $field = (self::DETAIL_INPUTS[$action][2] ?? null) === 'category-city' ? null : (self::DETAIL_INPUTS[$action][0] ?? null);
            $value = $field ? $business->getAttribute($field) : ($defaults[$action] ?? null);
            $out[$label] ??= [
                'key' => $action, 'label' => $label, 'section' => $section,
                'value' => is_scalar($value) && trim((string) $value) !== '' ? (string) $value : null,
                'missing' => empty($defaults[$action]),
            ];
        }

        $out = array_values($out);
        usort($out, fn ($a, $b) => $b['missing'] <=> $a['missing']);

        return $out;
    }

    /**
     * The card's spots with a picture put into one free-image spot — what
     * the business team saves from "Missing on your listing" without the
     * design editor. null = no such free-image spot.
     */
    public static function withSpotImage(array $hotspots, string $spotId, ?string $url): ?array
    {
        $found = false;
        foreach ($hotspots as &$h) {
            if (($h['id'] ?? null) === $spotId && ($h['action'] ?? null) === 'custom_image') {
                // A different picture starts centred again: the old one's zoom and position don't fit it.
                if (($h['value'] ?? null) !== $url) {
                    $h['fit'] = null;
                }
                $h['value'] = $url;
                $found = true;
            }
        }
        unset($h);

        return $found ? $hotspots : null;
    }

    /**
     * The card's spots with one picture box (logo or free image) moved and
     * zoomed — what the business team arranges from the open card. null =
     * no such picture box; a null fit puts the picture back as it was.
     */
    public static function withSpotFit(array $hotspots, string $spotId, ?array $fit): ?array
    {
        $found = false;
        foreach ($hotspots as &$h) {
            if (($h['id'] ?? null) === $spotId && in_array($h['action'] ?? null, ['logo', 'custom_image'], true)) {
                $h['fit'] = self::fit($fit);
                $found = true;
            }
        }
        unset($h);

        return $found ? $hotspots : null;
    }

    /** For a template, built before any business wears it: what each empty value will use. */
    public const TEMPLATE_DEFAULTS = [
        'call' => "the business's phone",
        'whatsapp' => "the business's WhatsApp (or phone)",
        'email' => "the business's email",
        'website' => "the business's website",
        'directions' => "the business's address",
        'instagram' => "the business's Instagram",
        'facebook' => "the business's Facebook page",
        'youtube' => "the business's YouTube channel",
        'google_review' => "the business's Google review link",
        'name' => "the business's name",
        'tagline' => "the business's category and city",
        'phone_text' => "the business's phone",
        'email_text' => "the business's email",
        'website_text' => "the business's website",
        'address' => "the business's address",
        'hours' => "the business's opening hours",
        'about' => "the business's description",
        'logo' => "the business's logo",
    ];

    /** The actions as the editors list them. */
    public static function actionList(): array
    {
        return collect(self::ACTIONS)->map(fn ($a, $key) => ['key' => $key, 'label' => $a['label'], 'icon' => $a['icon'], 'kind' => $a['kind'], 'value' => $a['value']])->values()->all();
    }

    /** The Google Fonts stylesheet for the fonts the actions use, or null. */
    public static function fontsUrl(array $hotspots): ?string
    {
        $families = collect($hotspots)->pluck('font')->filter(fn ($f) => in_array($f, CardEngine::FONTS, true))->unique()
            ->map(fn ($f) => 'family='.str_replace(' ', '+', $f).':wght@400;700')->implode('&');

        return $families ? "https://fonts.googleapis.com/css2?{$families}&display=swap" : null;
    }

    /** An action's inline text style (font, size scaled to the card, colours); every value is checked first. */
    public static function textStyle(array $h, ?array $colour = null): string
    {
        // The business's recolouring, worked out here rather than by a browser filter over the text.
        $paint = fn (string $hex) => $colour ? ImageColour::hex($hex, $colour) : $hex;
        $size = (int) ($h['fontSize'] ?? 0) ?: self::DEFAULT_FONT_SIZE;
        $css = sprintf('font-size:calc(%d * 100cqw / 480)', min(48, max(8, $size)));
        if (in_array($h['font'] ?? null, CardEngine::FONTS, true)) {
            $css .= ";font-family:'{$h['font']}',system-ui,sans-serif";
        }
        if (! empty($h['bold'])) {
            $css .= ';font-weight:700';
        }
        if (! empty($h['italic'])) {
            $css .= ';font-style:italic';
        }
        if (isset($h['color']) && preg_match(self::HEX, $h['color'])) {
            $css .= ';color:'.$paint($h['color']);
        }
        if (isset($h['bg']) && preg_match(self::HEX, $h['bg'])) {
            $css .= ';background:'.$paint($h['bg']);
        }
        if (in_array($h['align'] ?? null, self::ALIGNS, true)) {
            $css .= ';text-align:'.$h['align'].';justify-content:'.['left' => 'flex-start', 'center' => 'center', 'right' => 'flex-end'][$h['align']];
        }

        return $css;
    }

    /**
     * The boxes as the public page draws them: each with its link, and a
     * detail's text or picture; an action with nowhere to go, or a detail
     * the business hasn't filled in, is left out.
     */
    public static function resolved(array $hotspots, array $details, bool $preview = false): array
    {
        return collect($hotspots)
            ->filter(fn (array $h) => isset(self::ACTIONS[$h['action'] ?? '']))
            ->map(function (array $h) use ($details) {
                $kind = self::ACTIONS[$h['action']]['kind'];

                return [
                    ...$h,
                    'kind' => $kind,
                    'href' => self::href($h, $details),
                    'icon' => self::ACTIONS[$h['action']]['icon'] ?? 'link-2',
                    'text' => ($h['label'] ?? null) ?: (self::ACTIONS[$h['action']]['label'] ?? 'Open'),
                    'display' => $kind === 'text' ? self::display($h, $details) : null,
                    'src' => $kind === 'image' ? self::picture($h, $details) : null,
                ];
            })
            ->filter(fn (array $h) => match ($h['kind']) {
                'text' => $h['display'] !== null,
                'image' => $h['src'] !== null,
                default => $preview || $h['href'] !== null,
            })
            ->values()->all();
    }

    /** A business's image card as a standalone HTML document (the public /card/<slug> page or a preview); null = it has no image. */
    public static function render(Business $business, ?BusinessCard $card = null, bool $preview = false): ?string
    {
        $source = self::source($business, $card);

        return $source ? self::renderSource($source, CardEngine::details($business), $preview) : null;
    }

    /** @param  array{imageUrl: ?string, imageWidth: ?int, imageHeight: ?int, hotspots: ?array}  $source */
    /**
     * $marks (previews only): outline the invisible tap areas, and keep
     * actions that have nowhere to go yet — what the editor needs. Without
     * it a preview looks just like the public card (what an owner sees).
     */
    public static function renderSource(array $source, array $details, bool $preview = false, bool $marks = true, bool $embedded = false): string
    {
        $marks = $preview && $marks;
        // In a preview, "Save contact" downloads the contact from the dashboard — the
        // public file only exists once the card is live.
        if ($preview && ! empty($details['previewVcfUrl'])) {
            $details['vcfUrl'] = $details['previewVcfUrl'];
        }
        $w = $source['imageWidth'] ?? null;
        $h = $source['imageHeight'] ?? null;
        $colour = ImageColour::visible(ImageColour::normalize($source['colour'] ?? null));

        return view('cards.image', [
            'b' => $details,
            'image' => CardEngine::safeUrl($source['imageUrl'] ?? null) ?? '',
            'ratio' => $w && $h ? $h / $w : null,
            'spots' => self::resolved($source['hotspots'] ?? [], $details, $marks),
            'fontsUrl' => self::fontsUrl($source['hotspots'] ?? []),
            // Text and buttons take the colour only when it covers the whole card.
            'colour' => ImageColour::partial($colour) ? null : $colour,
            'colourMatrix' => $colour ? ImageColour::svgValues($colour) : null,
            // Colour in marked areas only: a recoloured copy of the image, masked to them.
            'colourMask' => ImageColour::partial($colour) ? ImageColour::mask($colour['areas']) : null,
            // The drawn actions' default text and chip colours, recoloured the same way.
            'spotInk' => $colour && ! ImageColour::partial($colour) ? ImageColour::hex('#ffffff', $colour) : '#ffffff',
            'spotChip' => implode(',', sscanf($colour && ! ImageColour::partial($colour) ? ImageColour::hex('#111827', $colour) : '#111827', '#%02x%02x%02x')),
            'preview' => $preview,
            'marks' => $marks,
            // A slide inside the Multi card view slider (cards/slider.blade.php).
            'embedded' => $embedded,
        ])->render();
    }
}
