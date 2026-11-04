<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// A review recently drafted for a business (App\Support\AiReview), kept so
// the next ones read differently.
class AiReviewDraft extends Model
{
    const CREATED_AT = 'createdAt';

    const UPDATED_AT = null;

    protected $table = 'ai_review_drafts';

    protected $fillable = ['businessId', 'text', 'fingerprint'];
}
