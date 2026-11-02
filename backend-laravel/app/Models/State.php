<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class State extends Model
{
    use HasUuid;

    public $timestamps = false;

    protected $fillable = ['name', 'code', 'country'];

    public function cities(): HasMany
    {
        return $this->hasMany(City::class, 'stateId');
    }
}
