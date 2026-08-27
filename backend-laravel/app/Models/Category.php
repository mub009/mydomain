<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = null;

    protected $table = 'categories';

    protected $fillable = ['name', 'slug', 'description', 'iconUrl', 'parentId'];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'parentId');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Category::class, 'parentId');
    }

    public function businesses(): HasMany
    {
        return $this->hasMany(Business::class, 'categoryId');
    }
}
