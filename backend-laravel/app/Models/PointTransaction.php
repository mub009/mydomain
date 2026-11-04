<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PointTransaction extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = null;

    protected $table = 'point_transactions';

    protected $fillable = ['userId', 'type', 'amount', 'balanceAfter', 'note', 'businessId', 'grantedById', 'feature', 'durationMonths', 'priceInr', 'commissionInr'];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'balanceAfter' => 'integer',
            'priceInr' => 'integer',
            'commissionInr' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function grantedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'grantedById');
    }
}
