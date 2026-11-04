<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// What a feature costs a dealer and for how long (App\Support\FeaturePlans).
class FeaturePlan extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $table = 'feature_plans';

    protected $primaryKey = 'feature';

    protected $keyType = 'string';

    protected $fillable = ['feature', 'points', 'durationMonths'];

    protected function casts(): array
    {
        return [
            'points' => 'integer',
            'durationMonths' => 'integer',
        ];
    }
}
