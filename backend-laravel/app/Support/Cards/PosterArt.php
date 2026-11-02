<?php

namespace App\Support\Cards;

/**
 * The built-in, offline poster-style background artist: no AI service, no
 * cost, just GD. It paints in a design's colours, in one of the styles
 * BackgroundGenerator offers, laid out from a seed (the business) so each
 * business gets its own picture and the same details give the same one.
 *
 * Soft light is painted pixel by pixel on a small canvas and scaled up,
 * which blurs it smoothly for free; crisp details (waves, sparkles, gold
 * lines, hills) are then drawn on top at full size.
 */
class PosterArt
{
    public const STYLES = ['poster', 'photo', 'illustration', 'festive', 'luxury'];

    private int $w;

    private int $h;

    private \GdImage $img;

    /** @var array<string, array{0: int, 1: int, 2: int}> */
    private array $c;

    /** @param  array{primary: string, accent: string, background?: string, surface?: string}  $colors */
    public static function render(string $style, array $colors, string $seed, bool $portrait): string
    {
        $art = new self($colors, $portrait);
        mt_srand(crc32($style.'|'.$seed));
        match (in_array($style, self::STYLES, true) ? $style : 'poster') {
            'festive' => $art->festive(),
            'luxury' => $art->luxury(),
            'illustration' => $art->illustration(),
            'photo' => $art->photo(),
            default => $art->poster(),
        };
        $art->grain(5);
        mt_srand();

        ob_start();
        imagepng($art->img, null, 6);
        imagedestroy($art->img);

        return ob_get_clean();
    }

    private function __construct(array $colors, bool $portrait)
    {
        [$this->w, $this->h] = $portrait ? [900, 1200] : [1280, 720];
        $rgb = fn (string $hex) => sscanf($hex, '#%02x%02x%02x');
        $this->c = ['primary' => $rgb($colors['primary']), 'accent' => $rgb($colors['accent'])];
        $this->img = imagecreatetruecolor($this->w, $this->h);
        imagealphablending($this->img, true);
        imageantialias($this->img, true);
    }

    // --- Colour helpers ---------------------------------------------------------

    private static function mix(array $a, array $b, float $t): array
    {
        return [$a[0] + ($b[0] - $a[0]) * $t, $a[1] + ($b[1] - $a[1]) * $t, $a[2] + ($b[2] - $a[2]) * $t];
    }

    private static function shade(array $c, float $t): array
    {
        return self::mix($c, [0, 0, 0], $t);
    }

    private static function tint(array $c, float $t): array
    {
        return self::mix($c, [255, 255, 255], $t);
    }

    /** A colour with opacity 0–1 (GD: 0 = opaque … 127 = clear). */
    private function color(array $c, float $opacity = 1.0): int
    {
        return imagecolorallocatealpha($this->img, (int) max(0, min(255, $c[0])), (int) max(0, min(255, $c[1])), (int) max(0, min(255, $c[2])), (int) round(127 * (1 - max(0, min(1, $opacity)))));
    }

    private function rand(float $min, float $max): float
    {
        return $min + mt_rand() / mt_getrandmax() * ($max - $min);
    }

    // --- Soft light: painted small, scaled up -----------------------------------

    /**
     * The base of every style: a gradient between two colours along an angle,
     * plus additive glows ([x, y, radius, colour, strength], in 0–1 units of
     * the image) and a vignette.
     */
    private function lightField(array $from, array $to, float $angle, array $glows, float $vignette = 0.45): void
    {
        $sw = (int) ($this->w / 8);
        $sh = (int) ($this->h / 8);
        $small = imagecreatetruecolor($sw, $sh);
        $dx = cos($angle);
        $dy = sin($angle);
        $aspect = $this->w / $this->h;
        for ($y = 0; $y < $sh; $y++) {
            for ($x = 0; $x < $sw; $x++) {
                $u = $x / ($sw - 1);
                $v = $y / ($sh - 1);
                $t = max(0, min(1, (($u - 0.5) * $dx + ($v - 0.5) * $dy) + 0.5));
                [$r, $g, $b] = self::mix($from, $to, $t * $t * (3 - 2 * $t));
                foreach ($glows as [$gx, $gy, $radius, $gc, $strength]) {
                    $d = sqrt((($u - $gx) * $aspect) ** 2 + ($v - $gy) ** 2) / $radius;
                    if ($d < 1) {
                        $k = $strength * (1 - $d) ** 2.2;
                        // Screen blend: brightens toward the glow colour.
                        $r = 255 - (255 - $r) * (1 - $k * $gc[0] / 255);
                        $g = 255 - (255 - $g) * (1 - $k * $gc[1] / 255);
                        $b = 255 - (255 - $b) * (1 - $k * $gc[2] / 255);
                    }
                }
                $edge = sqrt((($u - 0.5) * 1.15) ** 2 + (($v - 0.5) * 1.15) ** 2) / 0.81;
                $dark = 1 - $vignette * max(0, $edge - 0.35) ** 1.5 * 1.6;
                imagesetpixel($small, $x, $y, imagecolorallocate($small, (int) max(0, min(255, $r * $dark)), (int) max(0, min(255, $g * $dark)), (int) max(0, min(255, $b * $dark))));
            }
        }
        imagecopyresampled($this->img, $small, 0, 0, 0, 0, $this->w, $this->h, $sw, $sh);
        imagedestroy($small);
    }

    /**
     * Out-of-focus lights (bokeh), at full size: many thin rings of rising
     * opacity give each disc a soft, feathered edge and a brighter rim, like
     * a real lens.
     */
    private function bokeh(int $count, array $colors, float $minR, float $maxR, float $opacity, ?array $area = null): void
    {
        [$ax, $ay, $aw, $ah] = $area ?? [0, 0, 1, 1];
        for ($i = 0; $i < $count; $i++) {
            $c = $colors[mt_rand(0, count($colors) - 1)];
            $r = $this->rand($minR, $maxR) * $this->h;
            $x = (int) (($ax + $this->rand(0, $aw)) * $this->w);
            $y = (int) (($ay + $this->rand(0, $ah)) * $this->h);
            $o = $opacity * $this->rand(0.4, 1);
            $feather = max(3, (int) ($r * 0.22));
            // Feathered edge: each ring adds a little opacity toward the inside.
            for ($k = 0; $k < $feather; $k++) {
                $rr = $r + $feather / 2 - $k;
                imagefilledellipse($this->img, $x, $y, (int) ($rr * 2), (int) ($rr * 2), $this->color($c, $o * 0.5 / $feather));
            }
            // Bright rim, then a calmer centre.
            imageellipse($this->img, $x, $y, (int) ($r * 1.9), (int) ($r * 1.9), $this->color(self::tint($c, 0.3), $o * 0.25));
            imagefilledellipse($this->img, $x, $y, (int) ($r * 1.4), (int) ($r * 1.4), $this->color(self::tint($c, 0.15), $o * 0.08));
        }
    }

    /**
     * Light rays fanning from a point (0–1 units), at full size. Each ray is
     * eight overlapping wedges, widest and faintest first, so it brightens
     * toward its centre line and its edges feather out instead of stepping.
     */
    private function rays(float $ox, float $oy, int $count, array $c, float $opacity, float $spread = 1.2, float $start = 1.9): void
    {
        $x0 = $ox * $this->w;
        $y0 = $oy * $this->h;
        $len = hypot($this->w, $this->h) * 1.2;
        // GD's anti-aliasing draws polygon edges opaque, which would outline every wedge.
        imageantialias($this->img, false);
        for ($i = 0; $i < $count; $i++) {
            $a = $start + $spread * ($i / max(1, $count - 1)) + $this->rand(-0.04, 0.04);
            $width = $this->rand(0.02, 0.06);
            $o = $opacity * $this->rand(0.4, 1);
            for ($k = 8; $k >= 1; $k--) {
                $half = $width * $k / 8;
                imagefilledpolygon($this->img, [
                    (int) $x0, (int) $y0,
                    (int) ($x0 + cos($a - $half) * $len), (int) ($y0 + sin($a - $half) * $len),
                    (int) ($x0 + cos($a + $half) * $len), (int) ($y0 + sin($a + $half) * $len),
                ], $this->color($c, $o / 8));
            }
        }
        imageantialias($this->img, true);
    }

    // --- Crisp details ------------------------------------------------------------

    /** A filled wave band from a sine curve down to the bottom edge. */
    private function wave(float $baseY, float $amp, float $freq, float $phase, array $c, float $opacity, float $tilt = 0): void
    {
        $points = [0, $this->h];
        for ($x = 0; $x <= $this->w; $x += 8) {
            $u = $x / $this->w;
            $points[] = $x;
            $points[] = (int) (($baseY + $tilt * ($u - 0.5) + $amp * sin($u * $freq * M_PI * 2 + $phase) + $amp * 0.35 * sin($u * $freq * 5.1 + $phase * 1.7)) * $this->h);
        }
        $points[] = $this->w;
        $points[] = $this->h;
        imagefilledpolygon($this->img, $points, $this->color($c, $opacity));
    }

    /** Four-point sparkles with a little halo. */
    private function sparkles(int $count, array $c, float $minSize, float $maxSize, ?array $area = null): void
    {
        [$ax, $ay, $aw, $ah] = $area ?? [0, 0, 1, 1];
        for ($i = 0; $i < $count; $i++) {
            $x = ($ax + $this->rand(0, $aw)) * $this->w;
            $y = ($ay + $this->rand(0, $ah)) * $this->h;
            $s = $this->rand($minSize, $maxSize) * $this->h;
            $t = $s * 0.16;
            imagefilledellipse($this->img, (int) $x, (int) $y, (int) ($s * 1.1), (int) ($s * 1.1), $this->color($c, 0.10));
            imagefilledpolygon($this->img, [
                (int) $x, (int) ($y - $s), (int) ($x + $t), (int) ($y - $t), (int) ($x + $s), (int) $y, (int) ($x + $t), (int) ($y + $t),
                (int) $x, (int) ($y + $s), (int) ($x - $t), (int) ($y + $t), (int) ($x - $s), (int) $y, (int) ($x - $t), (int) ($y - $t),
            ], $this->color(self::tint($c, 0.55), 0.9));
        }
    }

    /** Fine film grain, so flat areas look printed rather than digital. */
    private function grain(int $strength): void
    {
        $n = (int) ($this->w * $this->h * 0.08);
        $light = $this->color([255, 255, 255], $strength / 100);
        $dark = $this->color([0, 0, 0], $strength / 100);
        for ($i = 0; $i < $n; $i++) {
            imagesetpixel($this->img, mt_rand(0, $this->w - 1), mt_rand(0, $this->h - 1), $i % 2 ? $light : $dark);
        }
    }

    // --- Styles -------------------------------------------------------------------

    // A bold advertising poster: deep gradient, big coloured glows, light
    // rays, flowing waves along the bottom, bokeh and sparkles.
    private function poster(): void
    {
        $p = $this->c['primary'];
        $a = $this->c['accent'];
        $flip = mt_rand(0, 1) === 1;
        $this->lightField(self::shade($p, 0.62), self::shade($p, 0.12), $this->rand(0.6, 1.1), [
            [$flip ? 0.18 : 0.82, 0.16, 0.85, $a, 0.85],
            [$flip ? 0.85 : 0.15, 0.95, 0.75, self::tint($p, 0.25), 0.55],
            [0.5, 0.45, 0.5, [255, 255, 255], 0.18],
        ]);
        $this->rays($flip ? 0.1 : 0.9, -0.05, 9, self::tint($a, 0.5), 0.16, 1.3, $flip ? 0.2 : 1.6);
        $this->bokeh(16, [self::tint($a, 0.3), self::tint($p, 0.5), [255, 255, 255]], 0.02, 0.09, 0.5, [0, 0, 1, 0.75]);
        $this->wave(0.80, 0.05, 1.1, $this->rand(0, 6), self::tint($a, 0.15), 0.38, $flip ? -0.08 : 0.08);
        $this->wave(0.86, 0.04, 1.6, $this->rand(0, 6), self::tint($p, 0.35), 0.35, $flip ? 0.06 : -0.06);
        $this->wave(0.92, 0.03, 2.1, $this->rand(0, 6), self::shade($p, 0.5), 0.55);
        $this->sparkles(9, self::tint($a, 0.4), 0.012, 0.035, [0.05, 0.05, 0.9, 0.6]);
    }

    // Photographic depth: a dark, rich scene of big out-of-focus lights and a warm light leak.
    private function photo(): void
    {
        $p = $this->c['primary'];
        $a = $this->c['accent'];
        $this->lightField(self::shade($p, 0.82), self::shade($p, 0.45), $this->rand(0.3, 1.2), [
            [$this->rand(0.6, 0.9), $this->rand(0.1, 0.35), 0.9, self::tint($a, 0.1), 0.75],
            [$this->rand(0.05, 0.3), $this->rand(0.6, 0.9), 0.7, self::tint($p, 0.3), 0.5],
        ], 0.6);
        $this->bokeh(10, [self::tint($a, 0.25), self::tint($p, 0.45)], 0.1, 0.22, 0.32);
        $this->bokeh(26, [self::tint($a, 0.45), [255, 240, 220], self::tint($p, 0.6)], 0.02, 0.07, 0.55);
        $this->sparkles(4, [255, 245, 230], 0.01, 0.02);
    }

    // A flat, modern illustrated landscape: sky, sun, clouds and layered hills.
    private function illustration(): void
    {
        $p = $this->c['primary'];
        $a = $this->c['accent'];
        $this->lightField(self::tint($p, 0.55), self::tint($a, 0.55), M_PI / 2, [
            [0.72, 0.32, 0.55, [255, 255, 255], 0.45],
        ], 0.15);
        $sunX = $this->rand(0.6, 0.82) * $this->w;
        $sunY = $this->rand(0.22, 0.34) * $this->h;
        $sunR = 0.16 * $this->h;
        foreach ([2.0 => 0.10, 1.5 => 0.16, 1.0 => 1.0] as $k => $o) {
            imagefilledellipse($this->img, (int) $sunX, (int) $sunY, (int) ($sunR * 2 * $k), (int) ($sunR * 2 * $k), $this->color(self::tint($a, 0.25), $o));
        }
        for ($i = 0; $i < 3; $i++) {
            $cx = $this->rand(0.08, 0.6) * $this->w;
            $cy = $this->rand(0.12, 0.38) * $this->h;
            $s = $this->rand(0.05, 0.09) * $this->h;
            foreach ([[-1.3, 0.3, 1.0], [0, 0, 1.4], [1.3, 0.3, 1.0], [0.6, 0.45, 1.1], [-0.6, 0.45, 1.1]] as [$ox, $oy, $k]) {
                imagefilledellipse($this->img, (int) ($cx + $ox * $s), (int) ($cy + $oy * $s), (int) ($s * 2 * $k), (int) ($s * 1.6 * $k), $this->color([255, 255, 255], 0.85));
            }
        }
        $layers = [[0.58, 0.07, self::tint($p, 0.3)], [0.68, 0.06, self::tint($p, 0.05)], [0.78, 0.05, self::shade($p, 0.25)], [0.88, 0.04, self::shade($p, 0.5)]];
        foreach ($layers as $i => [$y, $amp, $c]) {
            $this->wave($y, $amp, 0.6 + $i * 0.35, $this->rand(0, 6), $c, 1.0, $this->rand(-0.1, 0.1));
        }
        $this->sparkles(3, [255, 255, 255], 0.01, 0.02, [0.05, 0.05, 0.5, 0.3]);
    }

    // Celebration: warm glows, a garland of fairy lights, lots of sparkle.
    private function festive(): void
    {
        $p = $this->c['primary'];
        $a = $this->c['accent'];
        $warm = [255, 170, 60];
        $this->lightField(self::shade(self::mix($p, [90, 10, 0], 0.4), 0.55), self::shade(self::mix($p, $warm, 0.25), 0.2), $this->rand(0.7, 1.2), [
            [0.5, 0.0, 0.9, $warm, 0.7],
            [0.15, 0.85, 0.6, self::tint($a, 0.2), 0.5],
            [0.85, 0.8, 0.6, [255, 120, 150], 0.4],
        ], 0.5);
        $this->bokeh(40, [[255, 200, 90], [255, 140, 60], [255, 110, 150], self::tint($a, 0.3)], 0.015, 0.06, 0.65);
        // Two sagging garlands of lights.
        foreach ([[0.05, 0.16], [0.0, 0.3]] as [$top, $sag]) {
            for ($i = 0; $i <= 26; $i++) {
                $u = $i / 26;
                $x = $u * $this->w;
                $y = ($top + $sag * 4 * $u * (1 - $u)) * $this->h;
                $bulb = [[255, 220, 120], [255, 150, 80], [255, 120, 170], [150, 230, 255]][$i % 4];
                imagefilledellipse($this->img, (int) $x, (int) $y, 34, 34, $this->color($bulb, 0.12));
                imagefilledellipse($this->img, (int) $x, (int) $y, 18, 18, $this->color($bulb, 0.3));
                imagefilledellipse($this->img, (int) $x, (int) $y, 8, 8, $this->color(self::tint($bulb, 0.6), 1.0));
            }
        }
        $this->sparkles(22, [255, 225, 150], 0.01, 0.04);
        $this->wave(0.9, 0.025, 1.4, $this->rand(0, 6), self::shade($p, 0.55), 0.6);
    }

    // Luxury: deep near-black, a soft gold spotlight, art-deco fans and fine gold lines.
    private function luxury(): void
    {
        $p = $this->c['primary'];
        $gold = self::mix($this->c['accent'], [212, 175, 55], 0.35);
        $this->lightField(self::shade(self::mix($p, [20, 18, 14], 0.7), 0.4), self::shade(self::mix($p, [10, 10, 10], 0.8), 0.2), M_PI / 2, [
            [0.5, 0.25, 0.7, $gold, 0.5],
            [0.5, 1.1, 0.6, self::shade($gold, 0.3), 0.35],
        ], 0.7);
        // Art-deco fans rising from the bottom corners.
        imagesetthickness($this->img, 2);
        foreach ([[0.0, 1.0], [1.0, 1.0]] as [$fx, $fy]) {
            for ($r = 1; $r <= 7; $r++) {
                $rad = $r * 0.075 * $this->h * 1.6;
                imagearc($this->img, (int) ($fx * $this->w), (int) ($fy * $this->h), (int) ($rad * 2), (int) ($rad * 2), 180, 360, $this->color($gold, 0.55 - $r * 0.05));
            }
        }
        // Fine diagonal lines in the corners.
        for ($i = 0; $i < 10; $i++) {
            $o = $i * 14;
            imageline($this->img, $o, 0, 0, $o, $this->color($gold, 0.4));
            imageline($this->img, $this->w - $o, 0, $this->w, $o, $this->color($gold, 0.4));
        }
        imagesetthickness($this->img, 1);
        // A double gold frame.
        foreach ([18, 28] as $inset) {
            imagerectangle($this->img, $inset, $inset, $this->w - $inset, $this->h - $inset, $this->color($gold, 0.45));
        }
        $this->bokeh(12, [self::tint($gold, 0.2), $gold], 0.015, 0.05, 0.4, [0.1, 0.05, 0.8, 0.6]);
        $this->sparkles(12, self::tint($gold, 0.3), 0.01, 0.035, [0.1, 0.05, 0.8, 0.7]);
    }
}
