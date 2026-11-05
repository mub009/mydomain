<?php

namespace App\Support\Cards;

use App\Models\Business;
use App\Support\GoldRates\BusinessCard as LogoSource;
use chillerlan\QRCode\Common\EccLevel;
use chillerlan\QRCode\Output\QRGdImagePNG;
use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * A business's visiting card as a one-page PDF, in the design it wears,
 * with every action a real link: Call (tel:), WhatsApp, Directions, Email,
 * Website, the social profiles, "Open digital card" and "Save contact".
 *
 * Drawn with dompdf (pure PHP, so it works on shared hosting). dompdf only
 * understands simple CSS, so resources/views/cards/pdf.blade.php is its own
 * table-based layout using colours worked out here, and the images are
 * prepared here with GD: the background cropped to the header and darkened,
 * the logo cut into a circle. dompdf is never allowed to fetch anything
 * itself; images are only read from the app's own storage
 * (LogoSource::allowedHost), and a missing or foreign image is just left out.
 */
class CardPdf
{
    // 5.5 x 10 inches, a phone-shaped page, in points.
    private const PAGE = [0, 0, 396, 720];

    private const SERIF_FONTS = ['Playfair Display', 'Cormorant Garamond', 'Lora', 'Merriweather', 'Cinzel', 'Great Vibes'];

    private const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

    public static function filename(Business $business): string
    {
        return "{$business->slug}-visiting-card.pdf";
    }

    /** The PDF's bytes. $live: the card is public, so its own link, QR code and "Save contact" can be included. */
    public static function render(Business $business, bool $live): string
    {
        // An image card prints as its own artwork; if that can't be read, the template is the fallback.
        if (($source = ImageCard::source($business)) && ($pdf = self::renderImage($business, $source, $live)) !== null) {
            return $pdf;
        }

        $template = CardEngine::templateFor($business);
        $design = CardEngine::normalizeDesign($template?->design);
        $layout = $template?->layout ?? 'classic';
        $b = CardEngine::details($business);
        $c = $design['colors'];

        $backgroundUrl = $b['cardBackgroundUrl'] ?? null ?: ($template?->backgroundImageUrl ?: $b['coverImageUrl']);
        $hero = in_array($layout, ['classic', 'banner', 'split'], true);

        $view = [
            'b' => $b,
            'layout' => $layout,
            'c' => $c,
            // The design's colour for buttons, icons and links, swapped for a
            // readable one where it would vanish into the card.
            'ink' => CardEngine::readableOn($c['primary'], $c['surface'], [$c['accent'], $c['text']]),
            'radius' => ['rounded' => '9pt', 'pill' => '18pt', 'square' => '2pt', 'outline' => '9pt', 'soft' => '10pt'][$design['buttonStyle']],
            'buttonStyle' => $design['buttonStyle'],
            'tint' => fn (string $hex, float $amount) => self::mix($hex, '#ffffff', $amount),
            'shade' => fn (string $hex, float $amount) => self::mix($hex, '#000000', $amount),
            'headingFont' => in_array($design['fonts']['heading'], self::SERIF_FONTS, true) ? 'DejaVu Serif' : 'DejaVu Sans',
            // Sizes in pixels at the PDF's 144 dpi: 2px per point, the card being 364pt wide.
            'background' => $backgroundUrl ? self::background($backgroundUrl, $hero ? [728, $layout === 'classic' ? 300 : 400] : [728, $layout === 'luxury' ? 180 : 160], $design['overlay']) : null,
            'logo' => $b['logoUrl'] ? self::logo($b['logoUrl'], $layout === 'minimal' ? 'rounded' : 'circle') : null,
            'qr' => $live ? self::qr($b['cardUrl']) : null,
            'live' => $live,
            'icon' => fn (string $name, string $color, int $size = 12) => self::icon($name, $color, $size),
        ];

        // One page whenever possible: the normal size, then a compact one,
        // and only then a taller page (a very long address or description).
        $output = null;
        foreach ([[false, self::PAGE], [true, self::PAGE]] as [$compact, $paper]) {
            [$output, $pages] = self::draw(view('cards.pdf', [...$view, 'compact' => $compact])->render(), $paper, $b['name']);
            if ($pages === 1) {
                return $output;
            }
        }
        $tall = [0, 0, self::PAGE[2], self::PAGE[3] * $pages];

        return self::draw(view('cards.pdf', [...$view, 'compact' => true])->render(), $tall, $b['name'])[0];
    }

    /**
     * An image card as a PDF: one page the shape of the artwork, with every
     * action placed on it a clickable link over the same spot. Null when the
     * image can't be read.
     */
    private static function renderImage(Business $business, array $source, bool $live): ?string
    {
        $src = self::gd($source['imageUrl']);
        if (! $src) {
            return null;
        }
        // Re-encoded as a JPEG at most 1600px wide: dompdf can't read every
        // format the upload accepts (WebP), and it keeps the file small.
        $sw = imagesx($src);
        $sh = imagesy($src);
        // Recolouring goes pixel by pixel, so a recoloured image is kept smaller.
        $colour = ImageColour::normalize($source['colour'] ?? null);
        $scale = min(1, ($colour ? 1000 : 1600) / $sw);
        $dst = imagecreatetruecolor(max(1, (int) round($sw * $scale)), max(1, (int) round($sh * $scale)));
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
        imagecopyresampled($dst, $src, 0, 0, 0, 0, imagesx($dst), imagesy($dst), $sw, $sh);
        if ($colour) {
            ImageColour::applyGd($dst, $colour);
        }
        ob_start();
        imagejpeg($dst, null, 85);
        $jpeg = 'data:image/jpeg;base64,'.base64_encode((string) ob_get_clean());

        $width = self::PAGE[2];
        $height = round($width * $sh / $sw, 2);
        $details = CardEngine::details($business);
        $pt = $width / 480; // the editor's sizes are px at a 480px-wide card
        $spots = collect(ImageCard::resolved($source['hotspots'], $details))
            // Share needs a browser; "Save contact" and the QR code point at the
            // online card, which isn't up yet when not live.
            ->reject(fn ($h) => $h['action'] === 'share' || (in_array($h['action'], ['save_contact', 'qr'], true) && ! $live))
            ->map(function ($h) use ($width, $height, $pt, $colour) {
                $text = null;
                if ($h['kind'] === 'text') {
                    // dompdf has only its own fonts: the serif or sans one nearest the chosen font.
                    $text = sprintf(
                        'font-family:%s;font-size:%spt;font-weight:%s;font-style:%s;color:%s;text-align:%s;%s',
                        in_array($h['font'] ?? null, self::SERIF_FONTS, true) ? "'DejaVu Serif'" : "'DejaVu Sans'",
                        round(((int) ($h['fontSize'] ?? 0) ?: ImageCard::DEFAULT_FONT_SIZE) * $pt, 2),
                        empty($h['bold']) ? 'normal' : 'bold',
                        empty($h['italic']) ? 'normal' : 'italic',
                        $colour ? ImageColour::hex($h['color'] ?? '#ffffff', $colour) : ($h['color'] ?? '#ffffff'),
                        $h['align'] ?? 'left',
                        isset($h['bg']) ? 'background:'.($colour ? ImageColour::hex($h['bg'], $colour) : $h['bg']).';' : '',
                    );
                }

                return [
                    'kind' => $h['kind'],
                    'href' => $h['href'],
                    'text' => $h['text'],
                    'display' => $h['display'],
                    'textStyle' => $text,
                    'src' => $h['kind'] === 'image' ? (in_array($h['action'], ['logo', 'custom_image'], true)
                        ? (! empty($h['shape']) || ! empty($h['fit'])
                            ? self::shapedPng($h['src'], $h['w'] * $width / 100, $h['h'] * $height / 100, $h['shape'] ?: [[0, 0], [100, 0], [100, 100], [0, 100]], $h['fit'] ?? null)
                            : (! empty($h['radius']) ? self::roundedPng($h['src'], $h['w'] * $width / 100, $h['h'] * $height / 100, (int) $h['radius']) : self::png($h['src'])))
                        : $h['src']) : null,
                    'box' => sprintf('left:%spt;top:%spt;width:%spt;height:%spt', round($h['x'] * $width / 100, 2), round($h['y'] * $height / 100, 2), round($h['w'] * $width / 100, 2), round($h['h'] * $height / 100, 2)),
                ];
            })
            ->reject(fn ($h) => $h['kind'] === 'image' && ! $h['src'])
            ->values()->all();

        $html = view('cards.pdf-image', ['image' => $jpeg, 'width' => $width, 'height' => $height, 'spots' => $spots, 'name' => $details['name']])->render();

        return self::draw($html, [0, 0, $width, $height], $details['name'])[0];
    }

    /** An image from the app's storage as a PNG data URI dompdf can draw (it can't read WebP), or null. */
    private static function png(string $url): ?string
    {
        $img = self::gd($url);
        if (! $img) {
            return null;
        }
        imagesavealpha($img, true);
        ob_start();
        imagepng($img);

        return 'data:image/png;base64,'.base64_encode((string) ob_get_clean());
    }

    /**
     * A logo cropped to fill a $w x $h box (cover) with its corners rounded by
     * $radius percent of each side (50 = round), as a PNG data URI — dompdf
     * can't clip an image to rounded corners itself.
     */
    private static function roundedPng(string $url, float $w, float $h, int $radius): ?string
    {
        $src = self::gd($url);
        if (! $src || $w <= 0 || $h <= 0) {
            return null;
        }
        // Drawn at up to 4x the box's point size for a crisp edge, capped for memory.
        $k = min(4, 1200 / max($w, $h));
        $ow = max(1, (int) round($w * $k));
        $oh = max(1, (int) round($h * $k));
        $sw = imagesx($src);
        $sh = imagesy($src);
        $scale = max($ow / $sw, $oh / $sh);
        $cw = (int) round($ow / $scale);
        $ch = (int) round($oh / $scale);
        $tile = imagecreatetruecolor($ow, $oh);
        imagealphablending($tile, false);
        imagesavealpha($tile, true);
        imagefill($tile, 0, 0, imagecolorallocatealpha($tile, 0, 0, 0, 127));
        imagecopyresampled($tile, $src, 0, 0, (int) (($sw - $cw) / 2), (int) (($sh - $ch) / 2), $ow, $oh, $cw, $ch);

        // Clear what lies outside each corner's ellipse.
        $rx = $ow * $radius / 100;
        $ry = $oh * $radius / 100;
        $clear = imagecolorallocatealpha($tile, 0, 0, 0, 127);
        for ($y = 0; $y < $oh; $y++) {
            $py = $y + 0.5;
            $dy = $py < $ry ? $ry - $py : ($py > $oh - $ry ? $py - ($oh - $ry) : 0);
            if ($dy <= 0) {
                continue;
            }
            for ($x = 0; $x < $ow; $x++) {
                $px = $x + 0.5;
                $dx = $px < $rx ? $rx - $px : ($px > $ow - $rx ? $px - ($ow - $rx) : 0);
                if ($dx > 0 && ($dx / $rx) ** 2 + ($dy / $ry) ** 2 > 1) {
                    imagesetpixel($tile, $x, $y, $clear);
                }
            }
        }
        ob_start();
        imagepng($tile);

        return 'data:image/png;base64,'.base64_encode((string) ob_get_clean());
    }

    /**
     * A picture cropped to fill a $w x $h box (cover) and cut to a drawn
     * shape ([x, y] points in percent of the box), as a PNG data URI —
     * dompdf has no clip-path. $fit is the picture's rectangle in percent of
     * the box (moved and zoomed, always covering it — ImageCard::fit); none = centred, covering.
     */
    private static function shapedPng(string $url, float $w, float $h, array $shape, ?array $fit = null): ?string
    {
        $src = self::gd($url);
        if (! $src || $w <= 0 || $h <= 0 || count($shape) < 3) {
            return null;
        }
        $k = min(4, 1000 / max($w, $h));
        $ow = max(1, (int) round($w * $k));
        $oh = max(1, (int) round($h * $k));
        $sw = imagesx($src);
        $sh = imagesy($src);
        $scale = max($ow / $sw, $oh / $sh);
        $cw = (int) round($ow / $scale);
        $ch = (int) round($oh / $scale);
        $tile = imagecreatetruecolor($ow, $oh);
        imagealphablending($tile, false);
        imagesavealpha($tile, true);
        $clear = imagecolorallocatealpha($tile, 0, 0, 0, 127);
        imagefill($tile, 0, 0, $clear);
        $fit = ImageCard::fit($fit);
        if ($fit) {
            // The part of the picture that shows in the box: the box in the picture's own pixels.
            $vw = $sw * 100 / $fit['w'];
            $vh = $sh * 100 / $fit['h'];
            $sx = -$fit['l'] / 100 * $vw;
            $sy = -$fit['t'] / 100 * $vh;
        } else {
            // Centred, just covering.
            [$vw, $vh, $sx, $sy] = [$cw, $ch, ($sw - $cw) / 2, ($sh - $ch) / 2];
        }
        imagecopyresampled($tile, $src, 0, 0, (int) round($sx), (int) round($sy), $ow, $oh, max(1, (int) round($vw)), max(1, (int) round($vh)));

        // The shape, filled white on black, then everything outside it cleared.
        $mask = imagecreatetruecolor($ow, $oh);
        $points = [];
        foreach ($shape as [$x, $y]) {
            $points[] = (int) round($x * $ow / 100);
            $points[] = (int) round($y * $oh / 100);
        }
        imagefilledpolygon($mask, $points, imagecolorallocate($mask, 255, 255, 255));
        for ($y = 0; $y < $oh; $y++) {
            for ($x = 0; $x < $ow; $x++) {
                if ((imagecolorat($mask, $x, $y) & 0xFF) === 0) {
                    imagesetpixel($tile, $x, $y, $clear);
                }
            }
        }
        ob_start();
        imagepng($tile);

        return 'data:image/png;base64,'.base64_encode((string) ob_get_clean());
    }

    /** @return array{0: string, 1: int} the PDF and its page count */
    private static function draw(string $html, array $paper, string $title): array
    {
        $options = new Options();
        $options->setIsRemoteEnabled(false);
        $options->setIsPhpEnabled(false);
        $options->setIsJavascriptEnabled(false);
        $options->setDefaultFont('DejaVu Sans');
        $options->setDpi(144);
        // Fonts and their caches stay inside the app's storage.
        $fontDir = storage_path('fonts');
        if (! is_dir($fontDir)) {
            @mkdir($fontDir, 0775, true);
        }
        $options->setFontDir($fontDir);
        $options->setFontCache($fontDir);
        $options->setChroot([resource_path('views')]);

        $pdf = new Dompdf($options);
        $pdf->loadHtml($html, 'UTF-8');
        $pdf->setPaper($paper);
        $pdf->render();
        $pdf->addInfo('Title', $title.' — Visiting card');
        $pdf->addInfo('Creator', 'Markkito');

        $result = [$pdf->output(), $pdf->getCanvas()->get_page_count()];
        // dompdf's object graph is cyclic; free it now rather than at the end of the request.
        unset($pdf);
        gc_collect_cycles();

        return $result;
    }

    /** #rrggbb mixed toward another colour by $amount (0–1). */
    public static function mix(string $hex, string $toward, float $amount): string
    {
        $a = sscanf($hex, '#%02x%02x%02x');
        $b = sscanf($toward, '#%02x%02x%02x');

        return vsprintf('#%02x%02x%02x', array_map(fn ($x, $y) => (int) round($x + ($y - $x) * $amount), $a, $b));
    }

    // --- Images ----------------------------------------------------------------

    /** Image bytes from the app's own storage, or null. */
    private static function fetch(string $url): ?string
    {
        $encoded = Cache::remember('card-pdf-image:'.md5($url), now()->addHour(), function () use ($url) {
            try {
                if (str_starts_with($url, '/') && ! str_starts_with($url, '//')) {
                    $public = realpath(public_path());
                    $path = realpath(public_path(ltrim((string) parse_url($url, PHP_URL_PATH), '/')));
                    $body = $path && str_starts_with($path, $public.DIRECTORY_SEPARATOR) && is_file($path) && filesize($path) <= self::MAX_IMAGE_BYTES
                        ? (string) file_get_contents($path) : null;
                } elseif (LogoSource::allowedHost($url)) {
                    $response = Http::timeout(10)->withOptions(['allow_redirects' => false])->get($url);
                    $body = $response->successful() && strlen($response->body()) <= self::MAX_IMAGE_BYTES ? $response->body() : null;
                } else {
                    $body = null;
                }

                // Cached as base64: the cache may not keep raw bytes intact.
                return $body !== null && @getimagesizefromstring($body) ? base64_encode($body) : null;
            } catch (Throwable $e) {
                report($e);

                return null;
            }
        });

        return $encoded ? base64_decode($encoded) : null;
    }

    private static function gd(string $url): ?\GdImage
    {
        $bytes = self::fetch($url);
        $img = $bytes ? @imagecreatefromstring($bytes) : false;

        return $img ?: null;
    }

    /** Cropped to fill $w x $h (cover), darkened by $overlay, as a JPEG data URI. */
    private static function background(string $url, array $size, float $overlay): ?string
    {
        $src = self::gd($url);
        if (! $src) {
            return null;
        }
        [$w, $h] = $size;
        $sw = imagesx($src);
        $sh = imagesy($src);
        $scale = max($w / $sw, $h / $sh);
        $cw = (int) round($w / $scale);
        $ch = (int) round($h / $scale);
        $out = imagecreatetruecolor($w, $h);
        imagecopyresampled($out, $src, 0, 0, (int) (($sw - $cw) / 2), (int) (($sh - $ch) / 2), $w, $h, $cw, $ch);
        if ($overlay > 0) {
            imagealphablending($out, true);
            imagefilledrectangle($out, 0, 0, $w, $h, imagecolorallocatealpha($out, 0, 0, 0, (int) round(127 * (1 - $overlay))));
        }
        ob_start();
        imagejpeg($out, null, 85);

        return 'data:image/jpeg;base64,'.base64_encode(ob_get_clean());
    }

    /** The logo on white, cut into a circle (or a rounded square), as a PNG data URI. */
    private static function logo(string $url, string $shape): ?string
    {
        $src = self::gd($url);
        if (! $src) {
            return null;
        }
        $size = 320;
        $out = imagecreatetruecolor($size, $size);
        imagesavealpha($out, true);
        imagealphablending($out, false);
        imagefill($out, 0, 0, imagecolorallocatealpha($out, 0, 0, 0, 127));
        imagealphablending($out, true);

        // The shape, filled white, then the logo fitted inside it.
        $white = imagecolorallocate($out, 255, 255, 255);
        if ($shape === 'circle') {
            imagefilledellipse($out, $size / 2, $size / 2, $size, $size, $white);
        } else {
            imagefilledrectangle($out, 0, 0, $size, $size, $white);
        }
        $sw = imagesx($src);
        $sh = imagesy($src);
        $side = min($sw, $sh);
        $tile = imagecreatetruecolor($size, $size);
        imagefill($tile, 0, 0, $white);
        imagecopyresampled($tile, $src, 0, 0, (int) (($sw - $side) / 2), (int) (($sh - $side) / 2), $size, $size, $side, $side);

        // Copy only the pixels inside the shape.
        $r = $size / 2;
        for ($y = 0; $y < $size; $y++) {
            for ($x = 0; $x < $size; $x++) {
                if ($shape !== 'circle' || (($x - $r + 0.5) ** 2 + ($y - $r + 0.5) ** 2) <= $r * $r) {
                    imagesetpixel($out, $x, $y, imagecolorat($tile, $x, $y));
                }
            }
        }
        ob_start();
        imagepng($out);

        return 'data:image/png;base64,'.base64_encode(ob_get_clean());
    }

    public static function qr(string $text): string
    {
        $png = (new QRCode(new QROptions([
            'outputInterface' => QRGdImagePNG::class,
            'eccLevel' => EccLevel::H,
            'scale' => 10,
            'quietzoneSize' => 1,
            'outputBase64' => false,
        ])))->render($text);

        return 'data:image/png;base64,'.base64_encode($png);
    }

    /** A Lucide icon as an SVG data URI (dompdf draws SVG images, not inline <svg>). */
    private static function icon(string $name, string $color, int $size): string
    {
        static $icons = null;
        $icons ??= require resource_path('icons/lucide.php');
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="'.$color.'" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'.($icons[$name] ?? '').'</svg>';

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }
}
