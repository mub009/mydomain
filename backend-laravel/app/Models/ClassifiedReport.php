<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassifiedReport extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';

    const UPDATED_AT = null;

    protected $table = 'classified_reports';

    protected $fillable = ['listingId', 'reporterId', 'reason', 'message', 'status'];

    // create() doesn't re-fetch the row, so without this the DB column
    // default ('PENDING') wouldn't show up on the model returned to the client.
    protected $attributes = ['status' => 'PENDING'];

    public function listing(): BelongsTo
    {
        return $this->belongsTo(ClassifiedListing::class, 'listingId');
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporterId');
    }
}
