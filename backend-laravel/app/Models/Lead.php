<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Lead extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $table = 'leads';

    protected $fillable = ['businessId', 'customerId', 'name', 'phone', 'email', 'message', 'source', 'status'];

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class, 'businessId');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customerId');
    }
}
