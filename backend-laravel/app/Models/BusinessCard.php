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
    protected $fillable = ['businessId', 'templateId', 'backgroundImageUrl', 'isPublished', 'publishedAt', 'viewCount'];

    protected function casts(): array
    {
        return [
            'isPublished' => 'boolean',
            'publishedAt' => 'datetime',
            'viewCount' => 'integer',
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
