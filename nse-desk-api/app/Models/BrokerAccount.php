<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BrokerAccount extends Model
{
    protected $fillable = ['user_id', 'kite_app_id', 'broker', 'app_slot', 'client_id', 'name', 'access_token', 'expires_at', 'synced_at'];

    protected $hidden = ['access_token'];

    protected function casts(): array
    {
        return [
            'access_token' => 'encrypted', // encrypted with APP_KEY
            'expires_at' => 'datetime',
            'synced_at' => 'datetime',
            'app_slot' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function kiteApp(): BelongsTo
    {
        return $this->belongsTo(KiteApp::class);
    }

    public function holdings(): HasMany
    {
        return $this->hasMany(BrokerHolding::class);
    }

    /** A live Kite session (sessions end at 06:00 IST every day). */
    public function connected(): bool
    {
        return $this->access_token !== null && $this->expires_at !== null && $this->expires_at->isFuture() && $this->kiteApp !== null;
    }
}
