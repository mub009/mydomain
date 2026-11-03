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
 * brightness: 50–150, saturation: 0–200 }; null when nothing is changed.
 */
class ImageColour
{
    public const DEFAULTS = ['tint' => null, 'strength' => 50, 'hue' => 0, 'brightness' => 100, 'saturation' => 100];

    private const HEX = '/^#[0-9a-f]{6}$/i';

    public static function rules(): array
    {
        return [
            'imageColour' => ['sometimes', 'nullable', 'array'],
            'imageColour.tint' => ['nullable', 'regex:'.self::HEX],
            'imageColour.strength' => ['nullable', 'integer', 'min:0', 'max:100'],
            'imageColour.hue' => ['nullable', 'integer', 'min:-180', 'max:180'],
            'imageColour.brightness' => ['nullable', 'integer', 'min:50', 'max:150'],
            'imageColour.saturation' => ['nullable', 'integer', 'min:0', 'max:200'],
        ];
    }

    /** Checked settings, or null when they leave the image as it is. */
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
        $tinted = $c['tint'] !== null && $c['strength'] > 0;

        return $tinted || $c['hue'] !== 0 || $c['brightness'] !== 100 || $c['saturation'] !== 100 ? $c : null;
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
        $m = self::matrix($c);
        $rgb = sscanf($hex, '#%02x%02x%02x');
        $out = array_map(fn ($row) => (int) max(0, min(255, round($row[0] * $rgb[0] + $row[1] * $rgb[1] + $row[2] * $rgb[2]))), $m);

        return vsprintf('#%02x%02x%02x', $out);
    }

    /** Recolours a truecolor GD image in place (for the PDF). */
    public static function applyGd(GdImage $img, array $c): void
    {
        $m = self::matrix($c);
        $w = imagesx($img);
        $h = imagesy($img);
        $seen = [];
        $clamp = fn (float $v) => (int) max(0, min(255, round($v)));
        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                $rgb = imagecolorat($img, $x, $y);
                if (! isset($seen[$rgb])) {
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
