<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Visitor extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'visitors';

    protected $fillable = [
        'phone', 'latitude', 'longitude', 'city', 'consentAt', 'locationAt',
        'userAgent', 'visitCount', 'lastSeenAt',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'consentAt' => 'datetime',
            'locationAt' => 'datetime',
            'visitCount' => 'integer',
            'lastSeenAt' => 'datetime',
        ];
    }
}
