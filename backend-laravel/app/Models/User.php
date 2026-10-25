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

    /**
     * Mobile numbers are stored as their last 10 digits, so "+91 98765 43210"
     * and "9876543210" are the same login. Returns null for anything else.
     */
    public static function normalizePhone(string $value): ?string
    {
        $digits = preg_replace('/\D/', '', $value);
        if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
            $digits = substr($digits, 2);
        }

        return preg_match('/^[6-9]\d{9}$/', $digits) ? $digits : null;
    }

    // A login is either an email address or a mobile number.
    public static function findByLogin(string $login): ?self
    {
        $login = trim($login);
        if (str_contains($login, '@')) {
            return self::where('email', strtolower($login))->orWhere('email', $login)->first();
        }
        $phone = self::normalizePhone($login);

        // Older accounts may hold the number exactly as it was typed.
        return $phone ? self::whereIn('phone', [$phone, $login])->first() : null;
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
