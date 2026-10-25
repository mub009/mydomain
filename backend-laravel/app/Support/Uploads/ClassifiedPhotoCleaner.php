<?php

namespace App\Support\Uploads;

use App\Models\ClassifiedListing;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Once a listing is sold, removed by an admin, or hard-deleted there's no
 * path back to it needing its photos again (unlike EXPIRED, which the
 * seller can still renew — those are deliberately left alone), so the
 * uploaded files are just sitting in Spaces storage costing money for
 * nothing. This deletes the actual objects, then the DB rows.
 */
class ClassifiedPhotoCleaner
{
    public static function purge(ClassifiedListing $listing): void
    {
        $cdnBase = rtrim((string) config('filesystems.disks.spaces.url'), '/');

        if ($cdnBase !== '') {
            foreach ($listing->photos as $photo) {
                // Only ever delete an object this app actually owns on our
                // own CDN — a photo URL is stored as a plain string and
                // isn't guaranteed to point at our bucket.
                if (! str_starts_with($photo->url, $cdnBase.'/')) {
                    continue;
                }

                $key = substr($photo->url, strlen($cdnBase) + 1);

                try {
                    Storage::disk('spaces')->delete($key);
                } catch (Throwable $e) {
                    // A storage hiccup should never block the status change
                    // or leave the listing stuck — worst case an orphaned
                    // file sits in Spaces, which is the status quo today.
                    report($e);
                }
            }
        }

        $listing->photos()->delete();
    }
}
