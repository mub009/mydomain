<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GoldRateLogo extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'gold_rate_logos';

    protected $fillable = ['name', 'path', 'mime', 'width', 'height'];

    protected $hidden = ['path'];

    protected $appends = ['url'];

    protected function casts(): array
    {
        return [
            'width' => 'integer',
            'height' => 'integer',
        ];
    }

    public function templates(): HasMany
    {
        return $this->hasMany(GoldRateTemplate::class, 'logoId');
    }

    // Served to admins only (routes/web.php), never from a public folder.
    public function getUrlAttribute(): string
    {
        return "/admin/gold-rates/logos/{$this->id}/image";
    }
}
