<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Business extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'businesses';

    protected $fillable = [
        'ownerId', 'createdById', 'name', 'slug', 'description', 'categoryId',
        'status', 'subscriptionPlan', 'email', 'phone', 'website',
        'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country',
        'latitude', 'longitude', 'googlePlaceId', 'googleReviewUrl',
        'instagramUsername', 'facebookPageUrl', 'youtubeUrl', 'preferredReviewChannel',
        'logoUrl', 'coverImageUrl', 'isVerified', 'avgRating', 'reviewCount',
        'leadCount', 'viewCount',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'isVerified' => 'boolean',
            'avgRating' => 'float',
            'reviewCount' => 'integer',
            'leadCount' => 'integer',
            'viewCount' => 'integer',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ownerId');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'createdById');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'categoryId');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(BusinessPhoto::class, 'businessId');
    }

    public function hours(): HasMany
    {
        return $this->hasMany(BusinessHours::class, 'businessId');
    }

    public function services(): HasMany
    {
        return $this->hasMany(Service::class, 'businessId');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class, 'businessId');
    }
}
