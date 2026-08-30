<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Business extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'businesses';

    protected $fillable = [
        'ownerId', 'createdById', 'name', 'slug', 'description', 'categoryId',
        'status', 'subscriptionPlan', 'businessType', 'email', 'phone', 'website',
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

    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class, 'businessId');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class, 'businessId');
    }

    public function site(): HasOne
    {
        return $this->hasOne(BusinessSite::class, 'businessId');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'businessId');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'businessId');
    }

    public function reviewQrCodes(): HasMany
    {
        return $this->hasMany(ReviewQrCode::class, 'businessId');
    }

    public function reviewScans(): HasMany
    {
        return $this->hasMany(ReviewScan::class, 'businessId');
    }
}
