<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // AI Google Review (App\Support\AiReview): the business's settings for
    // the reviews the AI drafts for its customers — what to mention and in
    // which languages — and how often its page is opened and a review copied.
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->json('aiReview')->nullable();
            $table->unsignedInteger('aiReviewViews')->default(0);
            $table->unsignedInteger('aiReviewCopies')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('businesses', fn (Blueprint $table) => $table->dropColumn(['aiReview', 'aiReviewViews', 'aiReviewCopies']));
    }
};
