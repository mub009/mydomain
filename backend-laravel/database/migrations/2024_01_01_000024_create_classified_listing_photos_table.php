<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classified_listing_photos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('listingId');
            $table->string('url');
            $table->integer('sortOrder')->default(0);
            $table->timestamp('createdAt')->nullable();

            $table->foreign('listingId')->references('id')->on('classified_listings')->cascadeOnDelete();
            $table->index('listingId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classified_listing_photos');
    }
};
