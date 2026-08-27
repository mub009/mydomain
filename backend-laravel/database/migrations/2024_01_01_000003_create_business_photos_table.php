<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('business_photos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('businessId');
            $table->string('url');
            $table->string('caption')->nullable();
            $table->integer('sortOrder')->default(0);
            $table->timestamp('createdAt')->nullable();

            $table->foreign('businessId')->references('id')->on('businesses')->cascadeOnDelete();
            $table->index('businessId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_photos');
    }
};
