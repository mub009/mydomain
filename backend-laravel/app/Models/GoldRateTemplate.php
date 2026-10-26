<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use App\Support\GoldRates\BusinessCard;
use App\Support\GoldRates\TemplateLayout;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GoldRateTemplate extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'gold_rate_templates';

    protected $fillable = ['name', 'imagePath', 'thumbPath', 'imageWidth', 'imageHeight', 'businessId', 'layout', 'createdById'];

    protected $hidden = ['imagePath', 'thumbPath', 'business'];

    protected $appends = ['imageUrl', 'thumbUrl', 'businessCard'];

    protected function casts(): array
    {
        return [
            'imageWidth' => 'integer',
            'imageHeight' => 'integer',
        ];
    }

    // Read with anything newer than the saved layout (business detail boxes)
    // filled in, so every template has the full set.
    protected function layout(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => TemplateLayout::complete(json_decode((string) $value, true) ?: [], (int) $this->imageWidth, (int) $this->imageHeight),
            set: fn (array $value) => json_encode($value, JSON_UNESCAPED_UNICODE),
        );
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }

    // The linked business's details for the poster (null when none).
    public function getBusinessCardAttribute(): ?array
    {
        return $this->businessId ? BusinessCard::for($this->business) : null;
    }

    // Served to admins only (routes/web.php), never from a public folder.
    // The images are cached for good, so the URL names the stored file: a
    // changed master image gets a new URL.
    public function getImageUrlAttribute(): string
    {
        return "/admin/gold-rates/templates/{$this->id}/image?v=".substr(md5((string) $this->imagePath), 0, 10);
    }

    public function getThumbUrlAttribute(): string
    {
        return $this->thumbPath
            ? "/admin/gold-rates/templates/{$this->id}/thumb?v=".substr(md5($this->thumbPath), 0, 10)
            : $this->imageUrl;
    }
}
