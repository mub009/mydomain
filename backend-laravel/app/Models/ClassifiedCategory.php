<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClassifiedCategory extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';

    const UPDATED_AT = null;

    protected $table = 'classified_categories';

    protected $fillable = ['name', 'slug', 'iconUrl', 'parentId', 'sortOrder'];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(ClassifiedCategory::class, 'parentId');
    }

    public function children(): HasMany
    {
        return $this->hasMany(ClassifiedCategory::class, 'parentId');
    }

    public function listings(): HasMany
    {
        return $this->hasMany(ClassifiedListing::class, 'categoryId');
    }
}
