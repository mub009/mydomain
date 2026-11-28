<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One saved holding or position of a connected broker account (replaced on every refresh). */
class BrokerHolding extends Model
{
    protected $fillable = ['broker_account_id', 'kind', 'symbol', 'exchange', 'product', 'qty', 'avg_price', 'last_price', 'close_price', 'pnl', 'm2m', 'day_change_pct'];

    protected function casts(): array
    {
        return [
            'qty' => 'integer', 'avg_price' => 'float', 'last_price' => 'float', 'close_price' => 'float',
            'pnl' => 'float', 'm2m' => 'float', 'day_change_pct' => 'float',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(BrokerAccount::class, 'broker_account_id');
    }
}
