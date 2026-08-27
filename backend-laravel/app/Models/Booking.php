<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Booking extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'bookings';

    protected $fillable = [
        'businessId', 'serviceId', 'customerId', 'scheduledAt', 'status', 'notes', 'priceCents', 'currency',
    ];

    protected function casts(): array
    {
        return [
            'scheduledAt' => 'datetime',
            'priceCents' => 'integer',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'serviceId');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customerId');
    }
}
