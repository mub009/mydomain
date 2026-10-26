<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Today's rate for one purity (24K, 22K, 21K, 18K), entered by the admin
// and shared by every gold-rate template.
class GoldRate extends Model
{
    public const PURITIES = ['24K', '22K', '21K', '18K'];

    const CREATED_AT = null;
    const UPDATED_AT = 'updatedAt';

    protected $table = 'gold_rates';

    protected $primaryKey = 'purity';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['purity', 'rate', 'updatedById'];

    protected function casts(): array
    {
        return [
            'rate' => 'float',
            'updatedAt' => 'datetime',
        ];
    }

    // Every purity, in order, with null for one never entered.
    public static function current(): array
    {
        $rows = self::whereIn('purity', self::PURITIES)->get()->keyBy('purity');
        $rates = [];
        foreach (self::PURITIES as $purity) {
            $rates[$purity] = $rows[$purity]->rate ?? null;
        }

        return [
            'rates' => $rates,
            'updatedAt' => $rows->max('updatedAt')?->toISOString(),
        ];
    }
}
