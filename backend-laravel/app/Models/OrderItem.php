<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    use HasUuid;

    public $timestamps = false;

    protected $table = 'order_items';

    protected $fillable = ['orderId', 'productId', 'name', 'imageUrl', 'unitPriceCents', 'quantity', 'lineTotalCents'];

    protected function casts(): array
    {
        return [
            'unitPriceCents' => 'integer',
            'quantity' => 'integer',
            'lineTotalCents' => 'integer',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'orderId');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'productId');
    }
}
