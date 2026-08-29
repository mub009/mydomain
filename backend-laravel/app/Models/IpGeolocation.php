<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IpGeolocation extends Model
{
    const CREATED_AT = null;

    const UPDATED_AT = null;

    protected $table = 'ip_geolocations';

    protected $primaryKey = 'ip';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['ip', 'city', 'region', 'country', 'latitude', 'longitude', 'lookedUpAt'];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'lookedUpAt' => 'datetime',
        ];
    }
}
