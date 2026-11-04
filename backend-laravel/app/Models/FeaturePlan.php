<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// What a feature costs dealers in one pricing group, and for how long
// (App\Support\FeaturePlans).
class FeaturePlan extends Model
{
    public $timestamps = false;

    protected $table = 'feature_plan_prices';

    protected $fillable = ['groupId', 'feature', 'points', 'renewalPoints', 'priceInr', 'renewalPriceInr', 'commissionInr', 'renewalCommissionInr', 'durationMonths'];

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
