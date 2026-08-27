<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refresh_tokens', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('token')->unique();
            $table->uuid('userId');
            $table->timestamp('expiresAt');
            $table->timestamp('revokedAt')->nullable();
            $table->timestamp('createdAt')->nullable();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
            $table->index('userId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refresh_tokens');
    }
};
