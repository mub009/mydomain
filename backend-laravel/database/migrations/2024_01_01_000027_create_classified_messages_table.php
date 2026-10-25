<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classified_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('conversationId');
            $table->uuid('senderId');
            $table->text('body');
            $table->timestamp('createdAt', 6)->nullable();

            $table->foreign('conversationId')->references('id')->on('classified_conversations')->cascadeOnDelete();
            $table->foreign('senderId')->references('id')->on('users')->cascadeOnDelete();
            $table->index('conversationId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classified_messages');
    }
};
