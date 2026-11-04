<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // One Review (App\Support\OneReview): how often the business's one-QR
    // links page is opened, and how often each of its links is tapped.
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->unsignedInteger('oneReviewViews')->default(0);
            $table->json('oneReviewTaps')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('businesses', fn (Blueprint $table) => $table->dropColumn(['oneReviewViews', 'oneReviewTaps']));
    }
};
