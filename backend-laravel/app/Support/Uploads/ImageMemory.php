<?php

namespace App\Support\Uploads;

/**
 * Whether a picture can be opened with GD in the memory this request has.
 * GD holds every pixel in 4+ bytes, so a 65-megapixel PNG of a few MB takes
 * ~300MB once opened, whatever its file size. Instead of a fixed pixel cap,
 * the memory limit is raised as far as needed (up to MAX_LIMIT_MB) when the
 * server allows it; a picture that still doesn't fit is refused, not crashed on.
 */
class ImageMemory
{
    // Past this, refuse outright: no card or photo needs it (a "decompression bomb" guard).
    public const MAX_PIXELS = 120_000_000;

    private const MAX_LIMIT_MB = 1024;

    // Room kept for everything else the request does (dompdf, encoding, ...).
    private const HEADROOM = 96 * 1024 * 1024;

    /**
     * $mime: GD's PNG reader first loads the whole picture into a buffer of
     * its own and then builds the GD image beside it, so a PNG briefly takes
     * about twice what a JPEG or WebP of the same size does.
     */
    public static function roomFor(int $width, int $height, ?string $mime = null): bool
    {
        $pixels = $width * $height;
        if ($pixels <= 0 || $pixels > self::MAX_PIXELS) {
            return false;
        }
        $need = memory_get_usage() + $pixels * ($mime === 'image/png' ? 9 : 5) + self::HEADROOM;
        $limit = self::limit();
        if ($limit < 0 || $need <= $limit) {
            return true;
        }
        $mb = (int) ceil($need / 1048576 / 64) * 64;
        if ($mb > self::MAX_LIMIT_MB || @ini_set('memory_limit', $mb.'M') === false) {
            return false;
        }

        return self::limit() >= $need;
    }

    /** PHP's memory limit in bytes; -1 for none. */
    public static function limit(): int
    {
        $raw = trim((string) ini_get('memory_limit'));
        if ($raw === '' || $raw === '-1') {
            return -1;
        }

        return (int) $raw * match (strtolower(substr($raw, -1))) {
            'g' => 1024 ** 3, 'm' => 1024 ** 2, 'k' => 1024, default => 1,
        };
    }
}
