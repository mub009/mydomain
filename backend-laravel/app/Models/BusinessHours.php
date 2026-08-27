<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BusinessHours extends Model
{
    use HasUuid;

    public $timestamps = false;

    protected $table = 'business_hours';

    protected $fillable = ['businessId', 'dayOfWeek', 'openTime', 'closeTime', 'isClosed'];

    protected function casts(): array
    {
        return [
            'dayOfWeek' => 'integer',
            'isClosed' => 'boolean',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }
}
