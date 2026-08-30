<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClassifiedListing extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';

    const UPDATED_AT = 'updatedAt';

    protected $table = 'classified_listings';

    protected $fillable = [
        'sellerId', 'categoryId', 'title', 'slug', 'description', 'condition',
        'priceCents', 'currency', 'status', 'city', 'state', 'country',
        'latitude', 'longitude', 'contactPhone', 'whatsappEnabled', 'whatsappNumber',
        'viewCount', 'favoriteCount', 'bumpedAt', 'expiresAt', 'soldAt',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'whatsappEnabled' => 'boolean',
            'priceCents' => 'integer',
            'viewCount' => 'integer',
            'favoriteCount' => 'integer',
            'bumpedAt' => 'datetime',
            'expiresAt' => 'datetime',
            'soldAt' => 'datetime',
        ];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sellerId');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ClassifiedCategory::class, 'categoryId');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(ClassifiedListingPhoto::class, 'listingId')->orderBy('sortOrder');
    }

    public function favorites(): HasMany
    {
        return $this->hasMany(ClassifiedFavorite::class, 'listingId');
    }
}
