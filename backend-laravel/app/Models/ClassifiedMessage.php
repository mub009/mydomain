<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassifiedMessage extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';

    const UPDATED_AT = null;

    protected $table = 'classified_messages';

    // Microsecond precision so messages sent within the same second (a
    // quick back-and-forth) still order correctly — matches the same
    // gotcha already solved for page_views: the DB column alone isn't
    // enough, Eloquent's own write format has to be widened too.
    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['conversationId', 'senderId', 'body'];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(ClassifiedConversation::class, 'conversationId');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'senderId');
    }
}
