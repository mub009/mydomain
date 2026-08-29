<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visitors', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('phone', 20)->unique();
            $table->double('latitude')->nullable();
            $table->double('longitude')->nullable();
            $table->string('city', 100)->nullable();
            $table->timestamp('consentAt');
            $table->timestamp('locationAt')->nullable();
            $table->text('userAgent')->nullable();
            $table->integer('visitCount')->default(1);
            $table->timestamp('lastSeenAt')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->index('createdAt');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visitors');
    }
};
