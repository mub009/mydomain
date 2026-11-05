<?php

namespace App\Support\Uploads;

use GdImage;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Has Google Gemini's image model redraw an uploaded logo as a clean,
 * sharp, high-resolution copy — the same text, shapes and colours — on a
 * flat "key" colour that appears nowhere in the logo, so LogoCleaner can
 * cut the background away exactly (including the holes inside letters).
 *
 * Uses the same key and image model as the AI card backgrounds
 * (config services.gemini). Without a key, or when Gemini fails or returns
 * something unusable, LogoCleaner falls back to its own background removal.
 */
class AiLogoRedraw
{
    // Flat colours the logo can be redrawn on; the one furthest from every colour in the logo is used.
    private const KEYS = [
        [0, 255, 0],     // green
        [255, 0, 255],   // magenta
        [0, 0, 255],     // blue
        [0, 255, 255],   // cyan
        [255, 255, 0],   // yellow
    ];

    // The aspect ratios the image model can draw at.
    private const RATIOS = ['1:1' => 1, '4:3' => 4 / 3, '3:4' => 3 / 4, '3:2' => 3 / 2, '2:3' => 2 / 3, '16:9' => 16 / 9, '9:16' => 9 / 16, '5:4' => 5 / 4, '4:5' => 4 / 5, '21:9' => 21 / 9];

    // Gemini is sent the logo at no more than this.
    private const SEND_EDGE = 1024;

    public static function available(): bool
    {
        return strtolower((string) config('services.ai.provider')) !== 'builtin'
            && (bool) config('services.gemini.key')
            && (bool) config('services.gemini.image_model');
    }

    /**
     * @return array{image: GdImage, key: array{int, int, int}}
     *
     * @throws RuntimeException when Gemini can't redraw it
     */
    public static function redraw(GdImage $logo): array
    {
        $key = self::keyFor($logo);
        $w = imagesx($logo);
        $h = imagesy($logo);

        // The logo on white (any transparency flattened), at a sensible size.
        $scale = min(1, self::SEND_EDGE / max($w, $h));
        $sw = max(1, (int) round($w * $scale));
        $sh = max(1, (int) round($h * $scale));
        $send = imagecreatetruecolor($sw, $sh);
        imagefill($send, 0, 0, imagecolorallocate($send, 255, 255, 255));
        imagealphablending($send, true);
        imagecopyresampled($send, $logo, 0, 0, 0, 0, $sw, $sh, $w, $h);
        ob_start();
        imagepng($send);
        $png = (string) ob_get_clean();

        $hex = sprintf('#%02X%02X%02X', ...$key);
        $prompt = implode(' ', [
            'This image is a business logo. Redraw this exact logo as a clean, sharp, high-resolution, professional version:',
            'keep exactly the same text and spelling, letter shapes, symbols, colours, proportions and layout.',
            'Do not add, remove, restyle, translate or re-word anything. Fix only blur, noise, JPEG artefacts and jagged edges.',
            "Remove the original background completely and place the logo, centred with a small margin, on a perfectly flat, solid {$hex} background",
            "that fills the whole image — no shadow, glow, gradient, texture, border or frame, and no {$hex} anywhere inside the logo itself.",
        ]);

        $model = config('services.gemini.image_model');
        $base = rtrim((string) config('services.gemini.base_url'), '/');
        $bundle = config('services.gemini.ca_bundle');
        $response = Http::timeout(90)
            ->withOptions($bundle ? ['verify' => $bundle] : [])
            ->withHeaders(['x-goog-api-key' => config('services.gemini.key')])
            ->post("{$base}/v1beta/models/{$model}:generateContent", [
                'contents' => [['role' => 'user', 'parts' => [
                    ['inlineData' => ['mimeType' => 'image/png', 'data' => base64_encode($png)]],
                    ['text' => $prompt],
                ]]],
                'generationConfig' => [
                    'responseModalities' => ['IMAGE'],
                    'imageConfig' => ['aspectRatio' => self::ratioFor($w, $h)],
                ],
            ]);

        if ($response->failed()) {
            throw new RuntimeException("Gemini HTTP {$response->status()}: ".mb_substr($response->body(), 0, 300));
        }
        if ($reason = $response->json('promptFeedback.blockReason')) {
            throw new RuntimeException("Gemini blocked the logo ({$reason})");
        }
        foreach ($response->json('candidates.0.content.parts', []) as $part) {
            $inline = $part['inlineData'] ?? $part['inline_data'] ?? null;
            $bytes = $inline ? base64_decode((string) ($inline['data'] ?? ''), true) : false;
            if ($bytes && @getimagesizefromstring($bytes) && ($image = @imagecreatefromstring($bytes))) {
                return ['image' => $image, 'key' => $key];
            }
        }

        throw new RuntimeException('Gemini returned no image ('.($response->json('candidates.0.finishReason') ?? 'no candidate').')');
    }

    /** The key colour furthest from the logo's own colours. */
    private static function keyFor(GdImage $logo): array
    {
        $w = imagesx($logo);
        $h = imagesy($logo);
        $step = max(1, (int) floor(sqrt($w * $h / 4000)));
        $samples = [];
        for ($y = 0; $y < $h; $y += $step) {
            for ($x = 0; $x < $w; $x += $step) {
                $c = imagecolorat($logo, $x, $y);
                if ((($c >> 24) & 0x7F) < 64) {
                    $samples[] = [($c >> 16) & 0xFF, ($c >> 8) & 0xFF, $c & 0xFF];
                }
            }
        }
        $best = self::KEYS[0];
        $bestScore = -1;
        foreach (self::KEYS as $key) {
            $d = array_map(fn ($s) => sqrt(($s[0] - $key[0]) ** 2 + ($s[1] - $key[1]) ** 2 + ($s[2] - $key[2]) ** 2), $samples);
            sort($d);
            // The near-closest of the logo's colours (ignoring a few stray pixels).
            $score = $d ? $d[(int) floor(count($d) * 0.01)] : 441;
            if ($score > $bestScore) {
                [$best, $bestScore] = [$key, $score];
            }
        }

        return $best;
    }

    private static function ratioFor(int $w, int $h): string
    {
        $r = $w / $h;
        $best = '1:1';
        foreach (self::RATIOS as $name => $value) {
            if (abs(log($r / $value)) < abs(log($r / self::RATIOS[$best]))) {
                $best = $name;
            }
        }

        return $best;
    }
}
