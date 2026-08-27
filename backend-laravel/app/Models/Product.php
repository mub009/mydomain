<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'products';

    protected $fillable = [
        'businessId', 'name', 'slug', 'description', 'priceCents', 'compareAtCents', 'currency',
        'imageUrl', 'sku', 'trackStock', 'stock', 'isActive', 'sortOrder',
    ];

    protected function casts(): array
    {
        return [
            'priceCents' => 'integer',
            'compareAtCents' => 'integer',
            'trackStock' => 'boolean',
            'stock' => 'integer',
            'isActive' => 'boolean',
            'sortOrder' => 'integer',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class, 'productId');
    }
}
