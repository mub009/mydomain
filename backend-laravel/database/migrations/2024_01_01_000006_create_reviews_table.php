<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('businessId');
            $table->uuid('userId');
            $table->tinyInteger('rating');
            $table->string('title')->nullable();
            $table->text('comment')->nullable();
            $table->text('ownerReply')->nullable();
            $table->timestamp('ownerRepliedAt')->nullable();
            $table->boolean('isFlagged')->default(false);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('businessId')->references('id')->on('businesses')->cascadeOnDelete();
            $table->foreign('userId')->references('id')->on('users');
            $table->unique(['businessId', 'userId']);
            $table->index('businessId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reviews');
    }
};
