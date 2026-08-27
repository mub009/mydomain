<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BusinessSite extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'business_sites';

    protected $fillable = [
        'businessId', 'siteType', 'templateId', 'projectData', 'html', 'css',
        'isPublished', 'publishedAt', 'deliveryFeeCents', 'freeDeliveryAboveCents', 'acceptsOnlinePayment',
    ];

    protected function casts(): array
    {
        return [
            'projectData' => 'array',
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
}
