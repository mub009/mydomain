<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

// A set of feature prices dealers can be put in (App\Support\FeaturePlans).
class PricingGroup extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';

    const UPDATED_AT = null;

    protected $table = 'pricing_groups';

    protected $fillable = ['name', 'isDefault'];

    protected function casts(): array
    {
        return ['isDefault' => 'boolean'];
    }

    public function plans(): HasMany
    {
        return $this->hasMany(FeaturePlan::class, 'groupId');
    }

    public function dealers(): HasMany
    {
        return $this->hasMany(User::class, 'pricingGroupId');
    }
}
