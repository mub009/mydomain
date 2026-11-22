<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// An admin's CSS override for one website template (App\Support\SiteBuilder\TemplateRegistry),
// keyed by the template's own id rather than a generated one.
class SiteTemplateStyle extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $primaryKey = 'templateId';

    protected $table = 'site_template_styles';

    protected $fillable = ['templateId', 'customCss', 'updatedByUserId', 'updatedAt'];

    protected function casts(): array
    {
        return ['updatedAt' => 'datetime'];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updatedByUserId');
    }
}
