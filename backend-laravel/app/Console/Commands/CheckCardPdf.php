<?php

namespace App\Console\Commands;

use App\Models\Business;
use App\Support\Cards\CardImageUnavailable;
use App\Support\Cards\CardPdf;
use App\Support\Cards\ImageCard;
use Illuminate\Console\Command;
use Throwable;

// Says why a business's visiting-card PDF does or doesn't download: whether
// this server can fetch and open the card image (and each picture on it),
// the memory limit, and then a real attempt at the PDF.
class CheckCardPdf extends Command
{
    protected $signature = 'cards:check-pdf {business : The business slug (as in /card/<slug>) or its id}';

    protected $description = 'Diagnose a visiting card PDF download';

    public function handle(): int
    {
        $key = (string) $this->argument('business');
        $business = Business::with(['category', 'hours' => fn ($q) => $q->orderBy('dayOfWeek'), 'card'])
            ->where('slug', $key)->orWhere('id', $key)->first();
        if (! $business) {
            $this->error("No business with slug or id \"{$key}\".");

            return self::FAILURE;
        }
        $this->info("{$business->name} ({$business->slug})");

        $source = ImageCard::source($business);
        if (! $source) {
            $this->line('Its card has no image: the PDF is drawn from its layout template, no image to fetch.');
        } else {
            $this->line('Card image: '.$source['imageUrl'].(! empty($source['fromTemplate']) ? ' (from a ready-made design)' : ''));
            $failed = $this->report(CardPdf::checkImage($source['imageUrl']));
            foreach ($source['hotspots'] ?? [] as $h) {
                if (in_array($h['action'] ?? null, ['logo', 'custom_image'], true) && ! empty($h['value'])) {
                    $this->line("Picture ({$h['action']}): {$h['value']}");
                    $this->report(CardPdf::checkImage($h['value']));
                }
            }
            if ($failed) {
                $this->warn('The card image can\'t be used, so the download shows "Couldn\'t make the PDF".');
            }
        }

        $this->line('memory_limit: '.ini_get('memory_limit').' (the PDF raises it to 512M: '.(@ini_set('memory_limit', '512M') !== false ? 'allowed' : 'NOT allowed by this server').')');

        try {
            $pdf = CardPdf::render($business, false);
            $this->info(sprintf('PDF made: %.1f MB, peak memory %d MB.', strlen($pdf) / 1048576, memory_get_peak_usage() / 1048576));

            return self::SUCCESS;
        } catch (CardImageUnavailable $e) {
            $this->error('PDF not made: '.$e->getMessage());
        } catch (Throwable $e) {
            $this->error('PDF not made: '.get_class($e).': '.$e->getMessage());
        }

        return self::FAILURE;
    }

    /** Prints each step; true when any failed. */
    private function report(array $steps): bool
    {
        $failed = false;
        foreach ($steps as [$ok, $text]) {
            $ok ? $this->line("  ✓ {$text}") : $this->error("  ✗ {$text}");
            $failed = $failed || ! $ok;
        }

        return $failed;
    }
}
