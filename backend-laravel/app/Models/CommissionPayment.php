<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Commission the admin received from a dealer (App\Support\Commission).
class CommissionPayment extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';

    const UPDATED_AT = null;

    protected $table = 'commission_payments';

    protected $fillable = ['dealerId', 'amountInr', 'paidOn', 'note', 'receivedById'];

    protected function casts(): array
    {
        return [
            'amountInr' => 'integer',
            'paidOn' => 'date:Y-m-d',
        ];
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'receivedById');
    }
}
