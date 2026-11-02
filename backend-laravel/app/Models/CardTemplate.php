<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// One digital-visiting-card design. Holds only the look — layout, colours,
// fonts, background, button style — never any business's details.
class CardTemplate extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'card_templates';

    protected $fillable = [
        'categoryId', 'name', 'slug', 'layout', 'backgroundImageUrl', 'design',
        'isDefault', 'isActive', 'isPremium', 'sortOrder',
    ];

    protected function casts(): array
    {
        return [
            'design' => 'array',
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
