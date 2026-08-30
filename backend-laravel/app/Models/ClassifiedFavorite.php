<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassifiedFavorite extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';

    const UPDATED_AT = null;

    protected $table = 'classified_favorites';

    protected $fillable = ['userId', 'listingId'];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(ClassifiedListing::class, 'listingId');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }
}
