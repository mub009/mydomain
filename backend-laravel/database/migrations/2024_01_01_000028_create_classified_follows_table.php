<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classified_follows', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('followerId');
            $table->uuid('sellerId');
            $table->timestamp('createdAt')->nullable();

            $table->foreign('followerId')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('sellerId')->references('id')->on('users')->cascadeOnDelete();
            $table->unique(['followerId', 'sellerId']);
            $table->index('sellerId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classified_follows');
    }
};
