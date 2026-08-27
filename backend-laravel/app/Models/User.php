<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class User extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'users';

    protected $fillable = [
        'email', 'phone', 'passwordHash', 'firstName', 'lastName',
        'role', 'status', 'privileges', 'points', 'avatarUrl',
        'emailVerifiedAt', 'createdById',
    ];

    protected $hidden = ['passwordHash'];

    protected function casts(): array
    {
        return [
            'privileges' => 'array',
            'points' => 'integer',
            'emailVerifiedAt' => 'datetime',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'createdById');
    }

    public function businesses(): HasMany
    {
        return $this->hasMany(Business::class, 'ownerId');
    }

    public function refreshTokens(): HasMany
    {
        return $this->hasMany(RefreshToken::class, 'userId');
    }

    public function pointTransactions(): HasMany
    {
        return $this->hasMany(PointTransaction::class, 'userId');
    }
}
