<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('iconUrl')->nullable();
            $table->uuid('parentId')->nullable();
            $table->timestamp('createdAt')->nullable();

            $table->foreign('parentId')->references('id')->on('categories')->nullOnDelete();
            $table->index('parentId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
