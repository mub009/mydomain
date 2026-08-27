<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('businessId');
            $table->string('name');
            $table->text('description')->nullable();
            $table->integer('priceCents');
            $table->string('currency', 3)->default('INR');
            $table->integer('durationMins')->default(60);
            $table->boolean('isActive')->default(true);
            $table->timestamp('createdAt')->nullable();

            $table->foreign('businessId')->references('id')->on('businesses')->cascadeOnDelete();
            $table->index('businessId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('services');
    }
};
