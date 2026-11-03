<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// A business's digital visiting card: which template it wears and whether
// it is live. The details printed on it are read from the business itself.
class BusinessCard extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'business_cards';

    // backgroundImageUrl: the business's own background (e.g. AI-made),
    // worn over whichever template it picks.
    // imageUrl + hotspots: an image card — the business's own artwork with
    // actions placed on it (App\Support\Cards\ImageCard). Shown instead of
    // the template whenever an image is set.
    // imageColour: the business's recolouring of that image (ImageColour).
    protected $fillable = ['businessId', 'templateId', 'backgroundImageUrl', 'imageUrl', 'imageWidth', 'imageHeight', 'hotspots', 'imageColour', 'isPublished', 'publishedAt', 'viewCount'];

    protected function casts(): array
    {
        return [
            'isPublished' => 'boolean',
            'publishedAt' => 'datetime',
            'viewCount' => 'integer',
            'imageWidth' => 'integer',
            'imageHeight' => 'integer',
            'hotspots' => 'array',
            'imageColour' => 'array',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(CardTemplate::class, 'templateId');
    }
}
