<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// One digital-visiting-card design. Holds only the look — layout, colours,
// fonts, background, button style — never any business's details. An image
// template (imageUrl + hotspots) is instead an artwork with actions placed
// on it, each linked to the wearing business's details (ImageCard).
class CardTemplate extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'card_templates';

    protected $fillable = [
        'categoryId', 'name', 'slug', 'layout', 'backgroundImageUrl', 'imageUrl', 'imageWidth', 'imageHeight', 'hotspots', 'design',
        'isDefault', 'isActive', 'isPremium', 'sortOrder',
    ];

    protected function casts(): array
    {
        return [
            'design' => 'array',
            'hotspots' => 'array',
            'imageWidth' => 'integer',
            'imageHeight' => 'integer',
            'isDefault' => 'boolean',
            'isActive' => 'boolean',
            'isPremium' => 'boolean',
            'sortOrder' => 'integer',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'categoryId');
    }
}
