<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReviewQrCode extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'review_qr_codes';

    protected $fillable = [
        'code', 'status', 'channel', 'batchLabel', 'businessId', 'assignedAt', 'assignedById', 'scanCount',
    ];

    protected function casts(): array
    {
        return [
            'assignedAt' => 'datetime',
            'scanCount' => 'integer',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }

    public function scans(): HasMany
    {
        return $this->hasMany(ReviewScan::class, 'qrCodeId');
    }
}
