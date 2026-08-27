<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Review extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'reviews';

    protected $fillable = [
        'businessId', 'userId', 'rating', 'title', 'comment', 'ownerReply', 'ownerRepliedAt', 'isFlagged',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'isFlagged' => 'boolean',
            'ownerRepliedAt' => 'datetime',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }
}
