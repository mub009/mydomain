<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Support\GoldRates\BusinessCard;
use App\Support\Seo\SeoMeta;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * The picture WhatsApp, Facebook, Instagram, X and LinkedIn show when a
 * business link is shared (the page's og:image). Uploads are stored as
 * WebP, which several of those apps won't preview, so the logo is drawn
 * centred on a white 1200x630 card and served as a JPEG — the size and
 * format every one of them accepts, and well under WhatsApp's ~300KB limit.
 */
class ShareImageController extends Controller
{
    public const WIDTH = 1200;

    public const HEIGHT = 630;

    // The logo is fitted inside this box so WhatsApp's square crop of the
    // card's centre still shows all of it.
    private const LOGO_BOX = 520;

    public function __invoke(string $slug)
    {
        $business = Business::where('slug', $slug)->firstOrFail();

        $jpeg = null;
        if ($business->logoUrl && extension_loaded('gd')) {
            $jpeg = Cache::remember('share-image:'.md5($business->logoUrl), now()->addDay(), function () use ($business) {
                try {
                    return base64_encode(self::render(base64_decode(BusinessCard::logo($business)['body'])));
                } catch (Throwable $e) {
                    report($e);

                    return null;
                }
            });
        }

        if (! $jpeg) {
            // No usable logo: send the crawler to the cover / first photo.
            $fallback = SeoMeta::absoluteUrl($business->coverImageUrl ?: $business->photos()->value('url'));
            abort_unless($fallback, 404);

            return redirect()->away($fallback, 302);
        }

        return response(base64_decode($jpeg), 200, [
            'Content-Type' => 'image/jpeg',
            'Cache-Control' => 'public, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private static function render(string $bytes): string
    {
        $logo = @imagecreatefromstring($bytes);
        if (! $logo) {
            throw new \RuntimeException('Logo could not be decoded');
        }

        $canvas = imagecreatetruecolor(self::WIDTH, self::HEIGHT);
        imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
        imagealphablending($canvas, true);

        $w = imagesx($logo);
        $h = imagesy($logo);
        $scale = min(self::LOGO_BOX / $w, self::LOGO_BOX / $h, 4);
        $dw = (int) round($w * $scale);
        $dh = (int) round($h * $scale);
        imagecopyresampled($canvas, $logo, intdiv(self::WIDTH - $dw, 2), intdiv(self::HEIGHT - $dh, 2), 0, 0, $dw, $dh, $w, $h);
        imagedestroy($logo);

        ob_start();
        imagejpeg($canvas, null, 88);
        imagedestroy($canvas);

        return (string) ob_get_clean();
    }
}
