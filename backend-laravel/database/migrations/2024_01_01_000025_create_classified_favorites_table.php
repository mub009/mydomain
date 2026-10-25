<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classified_favorites', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('userId');
            $table->uuid('listingId');
            $table->timestamp('createdAt')->nullable();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('listingId')->references('id')->on('classified_listings')->cascadeOnDelete();
            $table->unique(['userId', 'listingId']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classified_favorites');
    }
};
