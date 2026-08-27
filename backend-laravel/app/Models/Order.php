<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use HasUuid;

    const CREATED_AT = 'placedAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'orders';

    protected $fillable = [
        'businessId', 'orderNumber', 'customerId', 'customerName', 'customerPhone', 'customerEmail',
        'addressLine1', 'addressLine2', 'city', 'postalCode', 'notes',
        'status', 'paymentMethod', 'subtotalCents', 'deliveryFeeCents', 'totalCents', 'currency',
    ];

    protected function casts(): array
    {
        return [
            'subtotalCents' => 'integer',
            'deliveryFeeCents' => 'integer',
            'totalCents' => 'integer',
            'placedAt' => 'datetime',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customerId');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class, 'orderId');
    }
}
