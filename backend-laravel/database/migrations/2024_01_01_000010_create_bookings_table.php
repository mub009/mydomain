<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('businessId');
            $table->uuid('serviceId');
            $table->uuid('customerId');
            $table->timestamp('scheduledAt');
            $table->enum('status', ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])->default('PENDING');
            $table->text('notes')->nullable();
            $table->integer('priceCents');
            $table->string('currency', 3)->default('INR');
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('businessId')->references('id')->on('businesses')->cascadeOnDelete();
            $table->foreign('serviceId')->references('id')->on('services');
            $table->foreign('customerId')->references('id')->on('users');
            $table->index(['businessId', 'scheduledAt']);
            $table->index('customerId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
