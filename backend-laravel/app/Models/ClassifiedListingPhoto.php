<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassifiedListingPhoto extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';

    const UPDATED_AT = null;

    protected $table = 'classified_listing_photos';

    protected $fillable = ['listingId', 'url', 'sortOrder'];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(ClassifiedListing::class, 'listingId');
    }
}
