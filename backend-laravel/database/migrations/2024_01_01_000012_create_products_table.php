<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('businessId');
            $table->string('name');
            $table->string('slug', 160);
            $table->text('description')->nullable();
            $table->integer('priceCents');
            $table->integer('compareAtCents')->nullable();
            $table->string('currency', 3)->default('INR');
            $table->text('imageUrl')->nullable();
            $table->string('sku', 60)->nullable();
            $table->boolean('trackStock')->default(false);
            $table->integer('stock')->default(0);
            $table->boolean('isActive')->default(true);
            $table->integer('sortOrder')->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('businessId')->references('id')->on('businesses')->cascadeOnDelete();
            $table->unique(['businessId', 'slug']);
            $table->index(['businessId', 'isActive']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
