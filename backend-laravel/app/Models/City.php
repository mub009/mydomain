<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class City extends Model
{
    use HasUuid;

    public $timestamps = false;

    protected $fillable = ['stateId', 'name'];

    public function state(): BelongsTo
    {
        return $this->belongsTo(State::class, 'stateId');
    }
}
