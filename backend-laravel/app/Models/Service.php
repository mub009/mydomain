<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Service extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = null;

    protected $table = 'services';

    protected $fillable = [
        'businessId', 'name', 'description', 'priceCents', 'currency', 'durationMins', 'isActive',
    ];

    protected function casts(): array
    {
        return [
            'priceCents' => 'integer',
            'durationMins' => 'integer',
            'isActive' => 'boolean',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }
}
