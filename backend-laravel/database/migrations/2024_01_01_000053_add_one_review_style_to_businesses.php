<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // The look of the business's One Review page (App\Support\OneReview::STYLES).
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->string('oneReviewStyle', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('businesses', fn (Blueprint $table) => $table->dropColumn('oneReviewStyle'));
    }
};
