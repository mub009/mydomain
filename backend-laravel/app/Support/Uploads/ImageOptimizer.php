<?php

namespace App\Support\Uploads;

use GdImage;
use Throwable;

/**
 * Resizes an oversized upload down to a sane maximum dimension and
 * converts it to WebP, so a multi-megabyte phone photo isn't stored (and
 * served to every visitor) at its full original size or in a heavier
 * format. Falls back to a same-format re-encode, and finally to the
 * original bytes untouched, whenever GD isn't available, the image can't
 * be decoded, or a step doesn't actually shrink it — a slightly larger
 * file beats a failed or corrupted upload.
 */
class ImageOptimizer
{
    // Nothing on this site is ever displayed wider than this, so a longer
    // edge beyond it is pure waste — no visible quality is gained by
    // storing it at full phone-camera resolution (often 3000-4000px+).
    private const MAX_DIMENSION = 2000;

    private const JPEG_QUALITY = 82;

    private const WEBP_QUALITY = 82;

    private const PNG_COMPRESSION = 6;

    // A "decompression bomb" guard — a tiny file can declare an enormous
    // pixel count, and decoding one into GD allocates width*height*4 bytes
    // regardless of how small the file was. 50MP is already far beyond any
    // real camera output, so anything past it is skipped rather than decoded.
    private const MAX_INPUT_PIXELS = 50_000_000;

    /**
     * @return array{contents: string, extension: string} the bytes to store,
     *              and the extension (hence format) they're actually in —
     *              "webp" whenever conversion succeeded and paid off,
     *              otherwise unchanged from the input.
     */
    public static function optimize(string $contents, string $extension): array
    {
        $original = ['contents' => $contents, 'extension' => $extension];

        // GIF is skipped outright — GD only ever decodes a GIF's first
        // frame, so re-encoding (in any format) would silently destroy any
        // animation.
        if ($extension === 'gif' || ! extension_loaded('gd')) {
            return $original;
        }

        $dimensions = @getimagesizefromstring($contents);
        if ($dimensions && ($dimensions[0] * $dimensions[1]) > self::MAX_INPUT_PIXELS) {
            return $original;
        }

        try {
            $image = @imagecreatefromstring($contents);
            if (! $image) {
                return $original;
            }

            if (in_array($extension, ['png', 'webp'], true)) {
                self::preserveAlpha($image);
            }
            if ($extension === 'jpg') {
                $image = self::applyExifOrientation($image, $contents);
            }

            $image = self::resizeIfOversized($image, $extension);

            // WebP compresses meaningfully better than JPEG or PNG at the
            // same visual quality, so every upload is converted to it.
            $webp = self::encode($image, 'webp');
            if ($webp !== null && strlen($webp) < strlen($contents)) {
                imagedestroy($image);

                return ['contents' => $webp, 'extension' => 'webp'];
            }

            // WebP encoding unavailable or didn't pay off (rare — mainly
            // tiny/simple images where format overhead dominates): fall
            // back to a same-format re-encode, then finally the original.
            if ($extension === 'webp') {
                imagedestroy($image);

                return $original;
            }

            $sameFormat = self::encode($image, $extension);
            imagedestroy($image);

            return ($sameFormat !== null && strlen($sameFormat) < strlen($contents))
                ? ['contents' => $sameFormat, 'extension' => $extension]
                : $original;
        } catch (Throwable) {
            return $original;
        }
    }

    private static function resizeIfOversized(GdImage $image, string $extension): GdImage
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $longestEdge = max($width, $height);

        if ($longestEdge <= self::MAX_DIMENSION) {
            return $image;
        }

        $scale = self::MAX_DIMENSION / $longestEdge;
        $resized = imagescale($image, (int) round($width * $scale), (int) round($height * $scale));
        if ($resized === false) {
            return $image;
        }

        imagedestroy($image);
        if (in_array($extension, ['png', 'webp'], true)) {
            self::preserveAlpha($resized);
        }

        return $resized;
    }

    private static function preserveAlpha(GdImage $image): void
    {
        imagealphablending($image, false);
        imagesavealpha($image, true);
    }

    private static function encode(GdImage $image, string $extension): ?string
    {
        ob_start();
        $ok = match ($extension) {
            'jpg' => imagejpeg($image, null, self::JPEG_QUALITY),
            'png' => imagepng($image, null, self::PNG_COMPRESSION),
            'webp' => function_exists('imagewebp') && function_exists('imagecreatefromstring')
                ? imagewebp($image, null, self::WEBP_QUALITY)
                : false,
            default => false,
        };
        $out = ob_get_clean();

        return $ok ? $out : null;
    }

    // Phone cameras commonly store a photo in the sensor's native
    // orientation plus an EXIF "Orientation" tag, rather than pre-rotating
    // the pixels. Re-encoding without honouring that tag would make the
    // stored copy display sideways or upside-down in any viewer that
    // doesn't itself apply EXIF rotation (most <img> tags don't).
    private static function applyExifOrientation(GdImage $image, string $contents): GdImage
    {
        if (! function_exists('exif_read_data')) {
            return $image;
        }

        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $contents);
        rewind($stream);
        $exif = @exif_read_data($stream, null, true);
        fclose($stream);

        $orientation = $exif['IFD0']['Orientation'] ?? null;
        $rotated = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => null,
        };

        if (! $rotated) {
            return $image;
        }

        imagedestroy($image);

        return $rotated;
    }
}
