<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // AI Google Review (App\Support\AiReview): the reviews recently drafted
    // for each business, so a new draft that reads too much like one of them
    // is written again. Only the latest few hundred per business are kept.
    public function up(): void
    {
        Schema::create('ai_review_drafts', function (Blueprint $table) {
            $table->id();
            $table->uuid('businessId');
            $table->text('text');
            // sha1 of the normalised text: catches exact repeats cheaply.
            $table->char('fingerprint', 40);
            $table->timestamp('createdAt')->nullable();

            $table->foreign('businessId')->references('id')->on('businesses')->cascadeOnDelete();
            $table->index(['businessId', 'createdAt']);
            $table->index(['businessId', 'fingerprint']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_review_drafts');
    }
};
