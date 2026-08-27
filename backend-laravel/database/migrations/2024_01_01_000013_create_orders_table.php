<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('businessId');
            $table->string('orderNumber', 24)->unique();
            $table->uuid('customerId')->nullable();

            $table->string('customerName');
            $table->string('customerPhone', 20);
            $table->string('customerEmail')->nullable();
            $table->string('addressLine1');
            $table->string('addressLine2')->nullable();
            $table->string('city');
            $table->string('postalCode', 20)->nullable();
            $table->text('notes')->nullable();

            $table->enum('status', ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'])->default('PENDING');
            $table->enum('paymentMethod', ['COD', 'ONLINE'])->default('COD');

            $table->integer('subtotalCents');
            $table->integer('deliveryFeeCents')->default(0);
            $table->integer('totalCents');
            $table->string('currency', 3)->default('INR');

            $table->timestamp('placedAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('businessId')->references('id')->on('businesses')->cascadeOnDelete();
            $table->foreign('customerId')->references('id')->on('users')->nullOnDelete();
            $table->index(['businessId', 'status']);
            $table->index(['businessId', 'placedAt']);
            $table->index(['businessId', 'customerPhone']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
