<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BusinessPhoto extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = null;

    protected $table = 'business_photos';

    protected $fillable = ['businessId', 'url', 'caption', 'sortOrder'];

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }
}
