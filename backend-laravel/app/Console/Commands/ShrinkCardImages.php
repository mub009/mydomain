<?php

namespace App\Console\Commands;

use App\Models\BusinessCard;
use App\Models\CardTemplate;
use App\Support\Uploads\ImageMemory;
use App\Support\Uploads\ImageOptimizer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

// Card images stored at full camera size (uploads over 50 megapixels used to
// be kept untouched): a 65-megapixel PNG takes ~600MB to open for the PDF and
// is slow on customers' phones. This replaces each with a copy shrunk the way
// uploads are (at most 2000px, WebP). The actions on a card sit in percent of
// the image, so they stay exactly in place.
class ShrinkCardImages extends Command
{
    protected $signature = 'cards:shrink-images
        {--apply : Replace the oversized images (without it, they are only listed)}
        {--max=2400 : Images longer than this many pixels on a side are shrunk}';

    protected $description = 'Shrink oversized visiting card images (business cards and ready-made designs)';

    public function handle(): int
    {
        $max = max(500, (int) $this->option('max'));
        $apply = (bool) $this->option('apply');
        $rows = BusinessCard::whereNotNull('imageUrl')->get()->concat(CardTemplate::whereNotNull('imageUrl')->get());
        $found = 0;
        $done = 0;
        foreach ($rows as $row) {
            $what = $row instanceof CardTemplate ? "design \"{$row->name}\"" : "business card {$row->businessId}";
            // The stored size, or the real one when it wasn't recorded.
            [$w, $h] = [(int) $row->imageWidth, (int) $row->imageHeight];
            $bytes = null;
            if (! $w || ! $h) {
                $bytes = $this->download($row->imageUrl);
                $size = $bytes ? @getimagesizefromstring($bytes) : null;
                [$w, $h] = $size ? [$size[0], $size[1]] : [0, 0];
            }
            if (max($w, $h) <= $max) {
                continue;
            }
            $found++;
            $this->line(sprintf('%s: %dx%d (%.0f MP) %s', $what, $w, $h, $w * $h / 1e6, $row->imageUrl));
            if (! $apply) {
                continue;
            }

            $bytes ??= $this->download($row->imageUrl);
            $size = $bytes ? @getimagesizefromstring($bytes) : null;
            if (! $size) {
                $this->error('  could not download it');

                continue;
            }
            if (! ImageMemory::roomFor($size[0], $size[1], $size['mime'])) {
                $this->error('  too big to open in the memory this server allows (memory_limit '.ini_get('memory_limit').')');

                continue;
            }
            $extension = ['image/png' => 'png', 'image/webp' => 'webp', 'image/jpeg' => 'jpg'][$size['mime']] ?? null;
            if (! $extension) {
                $this->error("  not a JPG, PNG or WebP ({$size['mime']})");

                continue;
            }
            $small = ImageOptimizer::optimize($bytes, $extension);
            unset($bytes);
            $new = @getimagesizefromstring($small['contents']);
            if (! $new || max($new[0], $new[1]) >= max($size[0], $size[1])) {
                $this->error('  could not be shrunk');

                continue;
            }
            try {
                $path = 'cards/images/'.Str::uuid().'.'.$small['extension'];
                Storage::disk('spaces')->put($path, $small['contents'], ['visibility' => 'public', 'ContentType' => $new['mime']]);
                $row->update(['imageUrl' => Storage::disk('spaces')->url($path), 'imageWidth' => $new[0], 'imageHeight' => $new[1]]);
                $done++;
                $this->info(sprintf('  now %dx%d, %.1f MB: %s', $new[0], $new[1], strlen($small['contents']) / 1048576, $row->imageUrl));
            } catch (Throwable $e) {
                $this->error('  could not be saved: '.$e->getMessage());
            }
        }

        if (! $found) {
            $this->info("No card images over {$max}px.");
        } elseif (! $apply) {
            $this->warn("{$found} oversized. Run again with --apply to shrink them.");
        } else {
            $this->info("{$done} of {$found} shrunk.");
        }

        return self::SUCCESS;
    }

    private function download(string $url): ?string
    {
        try {
            $response = Http::timeout(30)->get($url);
            if ($response->successful()) {
                return $response->body();
            }
        } catch (Throwable) {
            // tried from storage below
        }
        try {
            $path = ltrim(rawurldecode((string) parse_url($url, PHP_URL_PATH)), '/');

            return $path !== '' && Storage::disk('spaces')->exists($path) ? Storage::disk('spaces')->get($path) : null;
        } catch (Throwable) {
            return null;
        }
    }
}
