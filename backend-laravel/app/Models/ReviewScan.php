<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReviewScan extends Model
{
    use HasUuid;

    const CREATED_AT = 'scannedAt';

    const UPDATED_AT = null;

    protected $table = 'review_scans';

    protected $fillable = ['businessId', 'qrCodeId', 'channel', 'userAgent'];

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }

    public function qrCode(): BelongsTo
    {
        return $this->belongsTo(ReviewQrCode::class, 'qrCodeId');
    }
}
