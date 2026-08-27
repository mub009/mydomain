<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RefreshToken extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = null;

    protected $table = 'refresh_tokens';

    protected $fillable = ['token', 'userId', 'expiresAt', 'revokedAt'];

    protected function casts(): array
    {
        return [
            'expiresAt' => 'datetime',
            'revokedAt' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }
}
