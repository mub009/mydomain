<?php

namespace App\Models;

use App\Models\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClassifiedConversation extends Model
{
    use HasUuid;

    const CREATED_AT = 'createdAt';

    const UPDATED_AT = null;

    protected $table = 'classified_conversations';

    protected $fillable = ['listingId', 'buyerId', 'sellerId', 'lastMessageAt', 'buyerLastReadAt', 'sellerLastReadAt'];

    protected function casts(): array
    {
        return [
            'lastMessageAt' => 'datetime',
            'buyerLastReadAt' => 'datetime',
            'sellerLastReadAt' => 'datetime',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(ClassifiedListing::class, 'listingId');
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyerId');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sellerId');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ClassifiedMessage::class, 'conversationId')->orderBy('createdAt');
    }
}
