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

    protected $fillable = ['feature', 'points', 'renewalPoints', 'priceInr', 'renewalPriceInr', 'commissionInr', 'renewalCommissionInr', 'durationMonths'];

    protected function casts(): array
    {
        return [
            'points' => 'integer',
            'renewalPoints' => 'integer',
            'priceInr' => 'integer',
            'renewalPriceInr' => 'integer',
            'commissionInr' => 'integer',
            'renewalCommissionInr' => 'integer',
            'durationMonths' => 'integer',
        ];
    }
}
