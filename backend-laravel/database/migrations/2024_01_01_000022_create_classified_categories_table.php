<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // A separate taxonomy from the business `categories` table — "Mobiles",
    // "Vehicles", "Furniture" have nothing to do with business categories
    // like "Restaurants", and mixing them would pollute the business
    // category picker and admin screen.
    public function up(): void
    {
        Schema::create('classified_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('iconUrl')->nullable();
            $table->uuid('parentId')->nullable();
            $table->integer('sortOrder')->default(0);
            $table->timestamp('createdAt')->nullable();

            $table->foreign('parentId')->references('id')->on('classified_categories')->nullOnDelete();
            $table->index('parentId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classified_categories');
    }
};
