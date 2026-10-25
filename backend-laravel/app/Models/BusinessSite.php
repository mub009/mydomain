<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use App\Support\Seo\SeoTracker;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BusinessSite extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'business_sites';

    protected $fillable = [
        'businessId', 'siteType', 'templateId', 'projectData', 'html', 'css', 'sliderImages', 'galleryImages',
        'isPublished', 'publishedAt', 'deliveryFeeCents', 'freeDeliveryAboveCents', 'acceptsOnlinePayment',
    ];

    protected function casts(): array
    {
        return [
            'projectData' => 'array',
            'sliderImages' => 'array',
            'galleryImages' => 'array',
            'isPublished' => 'boolean',
            'publishedAt' => 'datetime',
            'deliveryFeeCents' => 'integer',
            'freeDeliveryAboveCents' => 'integer',
            'acceptsOnlinePayment' => 'boolean',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }

    // Publishing (or closing) the website changes which pages Google should
    // have — see App\Support\Seo\SeoTracker.
    protected static function booted(): void
    {
        static::saved(function (BusinessSite $site) {
            if ($site->wasRecentlyCreated || $site->wasChanged(['isPublished', 'publishedAt', 'siteType'])) {
                if ($business = Business::find($site->businessId)) {
                    SeoTracker::sync($business);
                }
            }
        });
    }
}
