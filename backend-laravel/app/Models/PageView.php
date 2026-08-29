<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;

class PageView extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';

    const UPDATED_AT = null;

    protected $table = 'page_views';

    // Eloquent's default date format truncates to whole seconds when
    // writing timestamps, even though the createdAt column itself stores
    // microseconds (see the migration) — without this override, "online
    // now" ordering ties again despite the wider column.
    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'visitorId', 'path', 'ip', 'city', 'region', 'country', 'latitude', 'longitude',
        'device', 'browser', 'referrer', 'userId',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }
}
