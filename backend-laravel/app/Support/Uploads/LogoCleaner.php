<?php

namespace App\Support\Uploads;

use GdImage;
use SplFixedArray;
use Throwable;

/**
 * Makes an uploaded logo ready for a visiting card, website or listing:
 *
 *  0. With AI available (AiLogoRedraw, Google Gemini), the logo is first
 *     redrawn sharp and high-resolution on a flat key colour, which is then
 *     cut away exactly — holes inside letters included. Without AI, or when
 *     it fails, step 1 does the job instead.
 *
 *  1. Removes a plain background. The colour around the image's edges is
 *     taken as the background and every pixel of it that's connected to an
 *     edge is cleared (flood fill), with soft, de-fringed edges. A logo on a
 *     busy background (a photo) is left alone, and so is colour of the
 *     background's tone inside the logo (white letters on a red badge stay).
 *  2. Trims the empty margin around what's left.
 *  3. Raises the quality: small logos are enlarged (bicubic) to a crisp
 *     working size and lightly sharpened, and the result is stored lossless
 *     (WebP, else PNG) instead of the lossy photo compression.
 *
 * Only GD is needed. Anything it can't handle returns null, and the caller
 * falls back to the ordinary ImageOptimizer.
 */
class LogoCleaner
{
    // Logos are worked on at no more than this, and enlarged to at least TARGET_MIN.
    private const MAX_EDGE = 1600;

    private const TARGET_MIN = 1000;

    // Colour distance (RGB, 0-441) treated as "the background", and the band above it that's feathered.
    private const TOLERANCE = 42;

    private const FEATHER = 38;

    // At least this share of the border must be the background's colour for it to count as plain.
    private const MIN_PLAIN_BORDER = 0.6;

    private const MAX_INPUT_PIXELS = 50_000_000;

    private const MAX_BYTES = 5 * 1024 * 1024;

    /**
     * @return array{contents: string, extension: string, mime: string, backgroundRemoved: bool, method: string}|null
     *               method: "ai" (redrawn by AI), "basic" (cleaned here) or "none" (background kept)
     */
    public static function clean(string $contents, string $extension, bool $removeBackground = true): ?array
    {
        if ($extension === 'gif' || ! extension_loaded('gd')) {
            return null;
        }
        $size = @getimagesizefromstring($contents);
        if (! $size || $size[0] * $size[1] > self::MAX_INPUT_PIXELS) {
            return null;
        }

        try {
            $src = @imagecreatefromstring($contents);
            if (! $src) {
                return null;
            }
            if ($extension === 'jpg') {
                $src = ImageOptimizer::applyExifOrientation($src, $contents);
            }
            $img = self::toTrueColourAlpha($src, self::MAX_EDGE);

            $removed = false;
            $method = $removeBackground ? 'basic' : 'none';
            if ($removeBackground && AiLogoRedraw::available()) {
                try {
                    ['image' => $ai, 'key' => $key] = AiLogoRedraw::redraw($img);
                    $ai = self::toTrueColourAlpha($ai, self::MAX_EDGE);
                    if (self::keyOut($ai, $key)) {
                        [$img, $removed, $method] = [$ai, true, 'ai'];
                    }
                } catch (Throwable $e) {
                    report($e); // fall back to the basic clean-up below
                }
            }
            if ($removeBackground && ! $removed) {
                $removed = self::removeBackground($img);
            }
            $img = self::trim($img);
            $img = self::enhance($img);

            return self::encode($img) + ['backgroundRemoved' => $removed, 'method' => $method];
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }

    /** A true-colour copy with an alpha channel, no larger than $maxEdge. */
    private static function toTrueColourAlpha(GdImage $src, int $maxEdge): GdImage
    {
        $w = imagesx($src);
        $h = imagesy($src);
        $scale = min(1, $maxEdge / max($w, $h));
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));
        $out = self::blank($nw, $nh);
        imagecopyresampled($out, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);

        return $out;
    }

    private static function blank(int $w, int $h): GdImage
    {
        $img = imagecreatetruecolor($w, $h);
        imagealphablending($img, false);
        imagesavealpha($img, true);
        imagefill($img, 0, 0, imagecolorallocatealpha($img, 0, 0, 0, 127));

        return $img;
    }

    /** Clears the plain, edge-connected background. False when there's none to clear. */
    private static function removeBackground(GdImage $img): bool
    {
        $w = imagesx($img);
        $h = imagesy($img);
        if ($w < 3 || $h < 3) {
            return false;
        }

        // The border's pixels, and how many of them are already see-through.
        $border = [];
        $clear = 0;
        $step = max(1, (int) floor(($w + $h) / 400));
        for ($x = 0; $x < $w; $x += $step) {
            $border[] = imagecolorat($img, $x, 0);
            $border[] = imagecolorat($img, $x, $h - 1);
        }
        for ($y = 0; $y < $h; $y += $step) {
            $border[] = imagecolorat($img, 0, $y);
            $border[] = imagecolorat($img, $w - 1, $y);
        }
        $opaque = [];
        foreach ($border as $c) {
            if ((($c >> 24) & 0x7F) > 100) {
                $clear++;
            } else {
                $opaque[] = $c;
            }
        }
        // Already on a transparent background.
        if ($clear > count($border) * 0.5 || ! $opaque) {
            return false;
        }

        // The background colour: the median of the border, which ignores a logo touching an edge.
        $bg = [self::median($opaque, 16), self::median($opaque, 8), self::median($opaque, 0)];
        $plain = 0;
        foreach ($opaque as $c) {
            if (self::distance($c, $bg) <= self::TOLERANCE) {
                $plain++;
            }
        }
        if ($plain < count($border) * self::MIN_PLAIN_BORDER) {
            return false; // a photo or a busy pattern: nothing safe to remove
        }

        // Flood fill from every edge pixel of the background's colour.
        // state: 0 = not seen, 1 = background (cleared), 2 = edge of the logo (feathered).
        $n = $w * $h;
        $state = new SplFixedArray($n);
        $queue = new \SplQueue();
        $seed = function (int $x, int $y) use ($img, $bg, $w, $state, $queue) {
            $i = $y * $w + $x;
            if ($state[$i] === null && self::distance(imagecolorat($img, $x, $y), $bg) <= self::TOLERANCE) {
                $state[$i] = 1;
                $queue->enqueue($i);
            }
        };
        for ($x = 0; $x < $w; $x++) {
            $seed($x, 0);
            $seed($x, $h - 1);
        }
        for ($y = 0; $y < $h; $y++) {
            $seed(0, $y);
            $seed($w - 1, $y);
        }
        if ($queue->isEmpty()) {
            return false;
        }

        $edge = [];
        $cleared = 0;
        while (! $queue->isEmpty()) {
            $i = $queue->dequeue();
            $cleared++;
            $x = $i % $w;
            $y = intdiv($i, $w);
            foreach ([[$x - 1, $y], [$x + 1, $y], [$x, $y - 1], [$x, $y + 1]] as [$nx, $ny]) {
                if ($nx < 0 || $ny < 0 || $nx >= $w || $ny >= $h) {
                    continue;
                }
                $j = $ny * $w + $nx;
                if ($state[$j] !== null) {
                    continue;
                }
                $c = imagecolorat($img, $nx, $ny);
                if ((($c >> 24) & 0x7F) > 100 || self::distance($c, $bg) <= self::TOLERANCE) {
                    $state[$j] = 1;
                    $queue->enqueue($j);
                } else {
                    $state[$j] = 2;
                    $edge[] = $j;
                }
            }
        }
        // Everything was "background": a blank or single-colour image — keep it as it was.
        if ($cleared >= $n * 0.995) {
            return false;
        }

        $transparent = imagecolorallocatealpha($img, 0, 0, 0, 127);
        for ($i = 0; $i < $n; $i++) {
            if ($state[$i] === 1) {
                imagesetpixel($img, $i % $w, intdiv($i, $w), $transparent);
            }
        }

        // The logo's outline: pixels close to the background colour were blended with it
        // (anti-aliasing). Make them partly see-through and take the background's tint out.
        foreach ($edge as $i) {
            $x = $i % $w;
            $y = intdiv($i, $w);
            $c = imagecolorat($img, $x, $y);
            $d = self::distance($c, $bg);
            if ($d >= self::TOLERANCE + self::FEATHER) {
                continue;
            }
            $a = max(0.08, ($d - self::TOLERANCE) / self::FEATHER); // 0..1 opacity
            $rgb = [($c >> 16) & 0xFF, ($c >> 8) & 0xFF, $c & 0xFF];
            $pure = array_map(fn ($v, $b) => (int) max(0, min(255, round(($v - $b * (1 - $a)) / $a))), $rgb, $bg);
            $alpha = (int) round(127 * (1 - $a));
            imagesetpixel($img, $x, $y, imagecolorallocatealpha($img, $pure[0], $pure[1], $pure[2], $alpha));
        }

        return true;
    }

    /**
     * Cuts the AI's flat key colour out of its redraw — everywhere, holes in
     * letters included, since the key colour isn't in the logo — with soft,
     * de-tinted edges. False when the redraw isn't on that colour (the AI
     * didn't follow the brief), so the caller can fall back.
     */
    private static function keyOut(GdImage $img, array $key): bool
    {
        $w = imagesx($img);
        $h = imagesy($img);

        // The background actually drawn: the median of the border, which must be close to the key asked for.
        $border = [];
        for ($x = 0; $x < $w; $x += 4) {
            $border[] = imagecolorat($img, $x, 0);
            $border[] = imagecolorat($img, $x, $h - 1);
        }
        for ($y = 0; $y < $h; $y += 4) {
            $border[] = imagecolorat($img, 0, $y);
            $border[] = imagecolorat($img, $w - 1, $y);
        }
        $bg = [self::median($border, 16), self::median($border, 8), self::median($border, 0)];
        if (self::distance(($key[0] << 16) | ($key[1] << 8) | $key[2], $bg) > 90) {
            return false;
        }

        $tolerance = 70; // generous: AI backgrounds are flat but not exactly one value
        $feather = 70;
        $transparent = imagecolorallocatealpha($img, 0, 0, 0, 127);
        $cleared = 0;
        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                $c = imagecolorat($img, $x, $y);
                $d = self::distance($c, $bg);
                if ($d <= $tolerance) {
                    imagesetpixel($img, $x, $y, $transparent);
                    $cleared++;
                } elseif ($d < $tolerance + $feather) {
                    $a = ($d - $tolerance) / $feather;
                    $rgb = [($c >> 16) & 0xFF, ($c >> 8) & 0xFF, $c & 0xFF];
                    $pure = array_map(fn ($v, $b) => (int) max(0, min(255, round(($v - $b * (1 - $a)) / $a))), $rgb, $bg);
                    imagesetpixel($img, $x, $y, imagecolorallocatealpha($img, $pure[0], $pure[1], $pure[2], (int) round(127 * (1 - $a))));
                }
            }
        }

        // Nothing left, or nothing removed: not a usable redraw.
        return $cleared > $w * $h * 0.05 && $cleared < $w * $h * 0.99;
    }

    /** Crops to what's visible, with a small even margin. */
    private static function trim(GdImage $img): GdImage
    {
        $w = imagesx($img);
        $h = imagesy($img);
        $minX = $w;
        $minY = $h;
        $maxX = -1;
        $maxY = -1;
        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                if (((imagecolorat($img, $x, $y) >> 24) & 0x7F) < 120) {
                    $minX = min($minX, $x);
                    $maxX = max($maxX, $x);
                    $minY = min($minY, $y);
                    $maxY = max($maxY, $y);
                }
            }
        }
        if ($maxX < 0) {
            return $img; // nothing visible
        }
        $cw = $maxX - $minX + 1;
        $ch = $maxY - $minY + 1;
        if ($cw === $w && $ch === $h) {
            return $img;
        }
        $pad = (int) round(max($cw, $ch) * 0.04);
        $out = self::blank($cw + 2 * $pad, $ch + 2 * $pad);
        imagecopy($out, $img, $pad, $pad, $minX, $minY, $cw, $ch);

        return $out;
    }

    /** Enlarges a small logo (bicubic) and sharpens it. */
    private static function enhance(GdImage $img): GdImage
    {
        $w = imagesx($img);
        $h = imagesy($img);
        $long = max($w, $h);
        if ($long < self::TARGET_MIN) {
            $scale = self::TARGET_MIN / $long;
            $nw = (int) round($w * $scale);
            $nh = (int) round($h * $scale);
            imagesetinterpolation($img, IMG_BICUBIC);
            $big = imagescale($img, $nw, $nh, IMG_BICUBIC);
            if ($big) {
                imagealphablending($big, false);
                imagesavealpha($big, true);
                $img = $big;
            }
            // A stronger unsharp after enlarging, to bring back crisp edges.
            self::sharpen($img, 0.6);
        } else {
            self::sharpen($img, 0.25);
        }

        return $img;
    }

    private static function sharpen(GdImage $img, float $amount): void
    {
        $edge = -$amount;
        $centre = 1 + 4 * $amount;
        imageconvolution($img, [[0, $edge, 0], [$edge, $centre, $edge], [0, $edge, 0]], 1, 0);
        imagealphablending($img, false);
        imagesavealpha($img, true);
    }

    /** Lossless WebP, else PNG — whichever is smaller — under the upload limit. */
    private static function encode(GdImage $img): array
    {
        $candidates = [];
        if (function_exists('imagewebp') && defined('IMG_WEBP_LOSSLESS')) {
            ob_start();
            if (imagewebp($img, null, IMG_WEBP_LOSSLESS)) {
                $candidates[] = ['contents' => (string) ob_get_clean(), 'extension' => 'webp', 'mime' => 'image/webp'];
            } else {
                ob_end_clean();
            }
        }
        ob_start();
        imagepng($img, null, 9);
        $candidates[] = ['contents' => (string) ob_get_clean(), 'extension' => 'png', 'mime' => 'image/png'];

        usort($candidates, fn ($a, $b) => strlen($a['contents']) <=> strlen($b['contents']));
        if (strlen($candidates[0]['contents']) <= self::MAX_BYTES) {
            return $candidates[0];
        }
        // Very detailed (photo-like) logos: near-lossless WebP keeps them under the limit.
        ob_start();
        imagewebp($img, null, 95);

        return ['contents' => (string) ob_get_clean(), 'extension' => 'webp', 'mime' => 'image/webp'];
    }

    private static function distance(int $c, array $bg): float
    {
        return sqrt(((($c >> 16) & 0xFF) - $bg[0]) ** 2 + ((($c >> 8) & 0xFF) - $bg[1]) ** 2 + (($c & 0xFF) - $bg[2]) ** 2);
    }

    private static function median(array $colours, int $shift): int
    {
        $v = array_map(fn ($c) => ($c >> $shift) & 0xFF, $colours);
        sort($v);

        return $v[intdiv(count($v), 2)];
    }
}
