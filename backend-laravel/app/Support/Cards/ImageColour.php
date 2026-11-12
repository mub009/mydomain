<?php

namespace App\Support\Cards;

use GdImage;

/**
 * A business's recolouring of its card image: a tint (a colour and how
 * strongly it washes over the image), a hue turn, brightness and
 * saturation. All four are linear in RGB, so together they are one 3×3
 * colour matrix — drawn by the browser as an SVG feColorMatrix on the public
 * card, and applied to the pixels for the PDF, so both look the same.
 * resources/js/lib/card-colour.js holds the same maths for the editor.
 *
 * Stored as { tint: '#rrggbb'|null, strength: 0–100, hue: -180–180,
 * brightness: 50–150, saturation: 0–200, areas: [...] }; null when nothing
 * is changed.
 *
 * areas: where the colour goes. Empty = the whole image. Otherwise a list of
 * outlines in percent of the image ({ erase: bool, points: [[x, y], ...] }),
 * drawn in order: each one adds the colour inside it, or an eraser takes it
 * away again — so a later shape wins where they overlap. The browser masks a
 * recoloured copy of the image with them (mask()); the PDF recolours only the
 * pixels inside them (applyGd()).
 */
class ImageColour
{
    public const DEFAULTS = ['tint' => null, 'strength' => 50, 'hue' => 0, 'brightness' => 100, 'saturation' => 100];

    // The one-tap colours offered for a card (the dashboard's colour panel and
    // the owner's bar on the public card): [key, label, swatch background, tint, saturation].
    public const SWATCHES = [
        ['original', 'Original', 'conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ef4444)', null, 100],
        ['blue', 'Blue', '#2563eb', '#2563eb', 100],
        ['green', 'Green', '#16a34a', '#16a34a', 100],
        ['red', 'Red', '#dc2626', '#dc2626', 100],
        ['gold', 'Gold', '#d4a017', '#d4a017', 100],
        ['purple', 'Purple', '#7c3aed', '#7c3aed', 100],
        ['pink', 'Pink', '#db2777', '#db2777', 100],
        ['teal', 'Teal', '#0d9488', '#0d9488', 100],
        ['mono', 'Black & white', 'linear-gradient(135deg,#111827 50%,#f3f4f6 50%)', null, 0],
    ];

    private const HEX = '/^#[0-9a-f]{6}$/i';

    public const MAX_AREAS = 40;

    public const MAX_AREA_POINTS = 160;

    public static function rules(): array
    {
        return [
            'imageColour' => ['sometimes', 'nullable', 'array'],
            'imageColour.tint' => ['nullable', 'regex:'.self::HEX],
            'imageColour.strength' => ['nullable', 'integer', 'min:0', 'max:100'],
            'imageColour.hue' => ['nullable', 'integer', 'min:-180', 'max:180'],
            'imageColour.brightness' => ['nullable', 'integer', 'min:50', 'max:150'],
            'imageColour.saturation' => ['nullable', 'integer', 'min:0', 'max:200'],
            'imageColour.areas' => ['nullable', 'array', 'max:'.self::MAX_AREAS],
            'imageColour.areas.*' => ['array'],
            'imageColour.areas.*.erase' => ['nullable', 'boolean'],
            'imageColour.areas.*.points' => ['required', 'array', 'min:3', 'max:'.self::MAX_AREA_POINTS],
            'imageColour.areas.*.points.*' => ['array', 'size:2'],
            'imageColour.areas.*.points.*.*' => ['numeric'],
        ];
    }

    /**
     * Checked settings, or null when they leave the image as it is and mark
     * no areas. Marked areas (where the colour may go, set by an admin) are
     * kept even with no colour picked ("Original"), so the business team's
     * next colour still goes only there.
     */
    public static function normalize(mixed $raw): ?array
    {
        if (! is_array($raw)) {
            return null;
        }
        $int = fn (string $key, int $lo, int $hi) => isset($raw[$key]) && is_numeric($raw[$key])
            ? (int) min($hi, max($lo, (int) round((float) $raw[$key])))
            : self::DEFAULTS[$key];
        $c = [
            'tint' => is_string($raw['tint'] ?? null) && preg_match(self::HEX, $raw['tint']) ? strtolower($raw['tint']) : null,
            'strength' => $int('strength', 0, 100),
            'hue' => $int('hue', -180, 180),
            'brightness' => $int('brightness', 50, 150),
            'saturation' => $int('saturation', 0, 200),
        ];
        $c['areas'] = self::areas($raw['areas'] ?? null);

        return self::changes($c) || $c['areas'] ? $c : null;
    }

    /** Whether the settings change the image at all (a colour, hue, brightness or saturation). */
    public static function changes(?array $c): bool
    {
        return $c !== null && (($c['tint'] !== null && $c['strength'] > 0)
            || $c['hue'] !== 0 || $c['brightness'] !== 100 || $c['saturation'] !== 100);
    }

    /** The settings to draw: null when they leave the image as it is (marked areas but no colour). */
    public static function visible(?array $c): ?array
    {
        return self::changes($c) ? $c : null;
    }

    /** Checked outlines: numbers only, inside the image, each with 3+ points; erasers before any area are dropped. */
    public static function areas(mixed $raw): array
    {
        // In key order: validated request data can come back with list keys
        // reordered, and here order is everything (outline points, x before y,
        // and which shape is drawn last).
        $list = function (mixed $v): array {
            if (! is_array($v)) {
                return [];
            }
            ksort($v);

            return array_values($v);
        };
        $out = [];
        foreach (array_slice($list($raw), 0, self::MAX_AREAS) as $area) {
            $points = [];
            foreach (array_slice($list($area['points'] ?? null), 0, self::MAX_AREA_POINTS) as $p) {
                $p = $list($p);
                if (is_numeric($p[0] ?? null) && is_numeric($p[1] ?? null)) {
                    $points[] = [round(min(100, max(0, (float) $p[0])), 2), round(min(100, max(0, (float) $p[1])), 2)];
                }
            }
            $erase = (bool) ($area['erase'] ?? false);
            // An eraser with nothing coloured under it yet does nothing.
            if (count($points) >= 3 && ! ($erase && ! $out)) {
                $out[] = ['erase' => $erase, 'points' => $points];
            }
        }

        return $out;
    }

    /** Whether the colour is limited to marked areas (else it covers the whole image). */
    public static function partial(?array $c): bool
    {
        return ! empty($c['areas']);
    }

    /**
     * The areas as an SVG image for a CSS mask over the recoloured copy of
     * the image: opaque where the colour shows. Numbers only.
     */
    public static function mask(array $areas): string
    {
        $shapes = '';
        foreach ($areas as $a) {
            $pts = implode(' ', array_map(fn ($p) => ((float) $p[0]).','.((float) $p[1]), $a['points']));
            $shapes .= '<polygon points="'.$pts.'" fill="'.($a['erase'] ? 'black' : 'white').'"/>';
        }
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">'
            .'<defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="black"/>'.$shapes.'</mask></defs>'
            .'<rect width="100" height="100" fill="white" mask="url(#m)"/></svg>';

        return 'data:image/svg+xml,'.rawurlencode($svg);
    }

    /**
     * The 3×3 matrix (rows = output R, G, B) for these settings: saturation,
     * then hue, then tint, then brightness — the same order as the editor.
     */
    public static function matrix(array $c): array
    {
        $s = $c['saturation'] / 100;
        $sat = [
            [0.213 + 0.787 * $s, 0.715 - 0.715 * $s, 0.072 - 0.072 * $s],
            [0.213 - 0.213 * $s, 0.715 + 0.285 * $s, 0.072 - 0.072 * $s],
            [0.213 - 0.213 * $s, 0.715 - 0.715 * $s, 0.072 + 0.928 * $s],
        ];
        $a = deg2rad($c['hue']);
        [$cos, $sin] = [cos($a), sin($a)];
        $hue = [
            [0.213 + $cos * 0.787 - $sin * 0.213, 0.715 - $cos * 0.715 - $sin * 0.715, 0.072 - $cos * 0.072 + $sin * 0.928],
            [0.213 - $cos * 0.213 + $sin * 0.143, 0.715 + $cos * 0.285 + $sin * 0.140, 0.072 - $cos * 0.072 - $sin * 0.283],
            [0.213 - $cos * 0.213 - $sin * 0.787, 0.715 - $cos * 0.715 + $sin * 0.715, 0.072 + $cos * 0.928 + $sin * 0.072],
        ];
        // Tint: each pixel's lightness, in the tint colour, mixed in by strength.
        $tint = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        if ($c['tint'] !== null && $c['strength'] > 0) {
            $rgb = array_map(fn ($v) => $v / 255, sscanf($c['tint'], '#%02x%02x%02x'));
            $lum = max(0.05, 0.2126 * $rgb[0] + 0.7152 * $rgb[1] + 0.0722 * $rgb[2]);
            $k = $c['strength'] / 100;
            foreach ([0, 1, 2] as $i) {
                $f = $rgb[$i] / $lum;
                $tint[$i] = [
                    (1 - $k) * ($i === 0 ? 1 : 0) + $k * $f * 0.2126,
                    (1 - $k) * ($i === 1 ? 1 : 0) + $k * $f * 0.7152,
                    (1 - $k) * ($i === 2 ? 1 : 0) + $k * $f * 0.0722,
                ];
            }
        }
        $b = $c['brightness'] / 100;
        $bright = [[$b, 0, 0], [0, $b, 0], [0, 0, $b]];

        return self::mul($bright, self::mul($tint, self::mul($hue, $sat)));
    }

    /** The matrix as an SVG feColorMatrix "values" list (4×5, alpha unchanged). */
    public static function svgValues(array $c): string
    {
        $m = self::matrix($c);
        $f = fn (float $v) => rtrim(rtrim(number_format($v, 4, '.', ''), '0'), '.') ?: '0';

        return collect($m)->map(fn ($row) => implode(' ', array_map($f, $row)).' 0 0')->implode(' ').' 0 0 0 1 0';
    }

    /** One #rrggbb colour recoloured the same way (text and buttons in the PDF). */
    public static function hex(string $hex, array $c): string
    {
        if (! preg_match(self::HEX, $hex)) {
            return $hex;
        }
        $rgb = sscanf($hex, '#%02x%02x%02x');
        // White and black (and nearly so) stay as they are — they keep text and buttons readable on any
        // colour; greys and coloured text (gold lettering, say) follow the new colour.
        if (max($rgb) - min($rgb) < 24 && (min($rgb) >= 225 || max($rgb) <= 40)) {
            return strtolower($hex);
        }
        $m = self::matrix($c);
        $out = array_map(fn ($row) => (int) max(0, min(255, round($row[0] * $rgb[0] + $row[1] * $rgb[1] + $row[2] * $rgb[2]))), $m);

        return vsprintf('#%02x%02x%02x', $out);
    }

    /** Recolours a truecolor GD image in place (for the PDF) — only inside its areas, when it has some. */
    public static function applyGd(GdImage $img, array $c): void
    {
        $m = self::matrix($c);
        $w = imagesx($img);
        $h = imagesy($img);
        $mask = self::partial($c) ? self::maskGd($c['areas'], $w, $h) : null;
        $seen = [];
        $clamp = fn (float $v) => (int) max(0, min(255, round($v)));
        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                if ($mask && (imagecolorat($mask, $x, $y) & 0xFF) < 128) {
                    continue;
                }
                $rgb = imagecolorat($img, $x, $y);
                if (! isset($seen[$rgb])) {
                    if (count($seen) >= 100_000) {
                        $seen = [];
                    }
                    $r = ($rgb >> 16) & 0xFF;
                    $g = ($rgb >> 8) & 0xFF;
                    $bl = $rgb & 0xFF;
                    $seen[$rgb] = ($clamp($m[0][0] * $r + $m[0][1] * $g + $m[0][2] * $bl) << 16)
                        | ($clamp($m[1][0] * $r + $m[1][1] * $g + $m[1][2] * $bl) << 8)
                        | $clamp($m[2][0] * $r + $m[2][1] * $g + $m[2][2] * $bl);
                }
                imagesetpixel($img, $x, $y, $seen[$rgb]);
            }
        }
    }

    /** The areas drawn white (colour) and black (erased) at the image's size, in order. */
    private static function maskGd(array $areas, int $w, int $h): GdImage
    {
        $mask = imagecreatetruecolor($w, $h);
        $black = imagecolorallocate($mask, 0, 0, 0);
        $white = imagecolorallocate($mask, 255, 255, 255);
        imagefill($mask, 0, 0, $black);
        foreach ($areas as $a) {
            $flat = [];
            foreach ($a['points'] as [$px, $py]) {
                $flat[] = (int) round($px / 100 * ($w - 1));
                $flat[] = (int) round($py / 100 * ($h - 1));
            }
            imagefilledpolygon($mask, $flat, $a['erase'] ? $black : $white);
        }

        return $mask;
    }

    private static function mul(array $a, array $b): array
    {
        $out = [];
        for ($i = 0; $i < 3; $i++) {
            for ($j = 0; $j < 3; $j++) {
                $out[$i][$j] = $a[$i][0] * $b[0][$j] + $a[$i][1] * $b[1][$j] + $a[$i][2] * $b[2][$j];
            }
        }

        return $out;
    }
}
