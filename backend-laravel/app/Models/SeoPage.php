<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SeoPage extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    // How long a page may take to show up in Google before the reports call
    // it overdue (and `seo:sync` asks Google again).
    public const TARGET_HOURS = 48;

    protected $table = 'seo_pages';

    protected $fillable = [
        'businessId', 'kind', 'url', 'needsSubmit', 'firstSubmittedAt', 'submittedAt', 'submitCount',
        'submitError', 'indexStatus', 'coverageState', 'lastCrawledAt', 'checkedAt', 'indexedAt',
    ];

    protected function casts(): array
    {
        return [
            'needsSubmit' => 'boolean',
            'submitCount' => 'integer',
            'firstSubmittedAt' => 'datetime',
            'submittedAt' => 'datetime',
            'lastCrawledAt' => 'datetime',
            'checkedAt' => 'datetime',
            'indexedAt' => 'datetime',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }

    // Where the page stands against the two-day target: INDEXED, WAITING
    // (inside the window) or OVERDUE (past it, still not in Google). The
    // clock starts when the page went live — the row is created then.
    public function stage(): string
    {
        if ($this->indexStatus === 'INDEXED') {
            return 'INDEXED';
        }
        $since = $this->createdAt ?? now();

        return $since->diffInHours(now()) >= self::TARGET_HOURS ? 'OVERDUE' : 'WAITING';
    }

    public function toArray(): array
    {
        return [...parent::toArray(), 'stage' => $this->stage()];
    }
}
