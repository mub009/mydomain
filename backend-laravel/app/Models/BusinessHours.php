<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BusinessHours extends Model
{
    use HasUuid;

    public $timestamps = false;

    protected $table = 'business_hours';

    protected $fillable = ['businessId', 'dayOfWeek', 'openTime', 'closeTime', 'isClosed'];

    protected function casts(): array
    {
        return [
            'dayOfWeek' => 'integer',
            'isClosed' => 'boolean',
        ];
    }

    public const DEFAULT_OPEN = '09:00';

    public const DEFAULT_CLOSE = '18:00';

    /** The default week: 9:00–18:00, closed Sunday (dayOfWeek 0). */
    public static function defaultWeek(): array
    {
        return array_map(fn ($day) => [
            'dayOfWeek' => $day,
            'openTime' => self::DEFAULT_OPEN,
            'closeTime' => self::DEFAULT_CLOSE,
            'isClosed' => $day === 0,
        ], range(0, 6));
    }

    /** Saves the default week for a business that has no hours yet. */
    public static function createDefaultsFor(string $businessId): void
    {
        if (self::where('businessId', $businessId)->exists()) {
            return;
        }
        foreach (self::defaultWeek() as $hour) {
            self::create([...$hour, 'businessId' => $businessId]);
        }
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }
}
