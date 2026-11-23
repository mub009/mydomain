<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A user's own Kite Connect app: API key, and the secret encrypted with APP_KEY. */
class KiteApp extends Model
{
    protected $fillable = ['user_id', 'label', 'api_key', 'api_secret'];

    protected $hidden = ['api_secret'];

    protected function casts(): array
    {
        return ['api_secret' => 'encrypted'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function accounts(): HasMany
    {
        return $this->hasMany(BrokerAccount::class);
    }

    /** What the Kite service needs. */
    public function credentials(): array
    {
        return ['id' => $this->id, 'key' => $this->api_key, 'secret' => $this->api_secret];
    }

    /** "abcd••••wxyz": enough to recognise it, never the whole key. */
    public function maskedKey(): string
    {
        $k = $this->api_key;

        return strlen($k) <= 8 ? str_repeat('•', strlen($k)) : substr($k, 0, 4).'••••'.substr($k, -4);
    }
}
