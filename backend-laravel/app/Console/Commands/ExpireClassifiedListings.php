<?php

namespace App\Console\Commands;

use App\Models\ClassifiedListing;
use Illuminate\Console\Command;

// Nothing else in the app ever flips a listing to EXPIRED on its own — a
// seller has to notice and act, or (per Schedule::command in
// routes/console.php) this runs daily to do it for them. Deliberately
// doesn't touch photos: unlike a sold or removed listing, an expired one
// can still be revived via renew() without re-uploading anything.
class ExpireClassifiedListings extends Command
{
    protected $signature = 'classifieds:expire';

    protected $description = 'Mark ACTIVE classified listings past their expiry date as EXPIRED';

    public function handle(): int
    {
        $count = ClassifiedListing::where('status', 'ACTIVE')
            ->whereNotNull('expiresAt')
            ->where('expiresAt', '<', now())
            ->update(['status' => 'EXPIRED']);

        $this->info("Expired {$count} classified listing(s).");

        return self::SUCCESS;
    }
}
