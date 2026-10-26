<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;

// A rate-box design saved by the admin, shown with the built-in presets.
class GoldRatePreset extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'gold_rate_presets';

    protected $fillable = ['name', 'style', 'createdById'];

    protected function casts(): array
    {
        return ['style' => 'array'];
    }
}
