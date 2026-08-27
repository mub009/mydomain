<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('orderId');
            $table->uuid('productId')->nullable();

            $table->string('name');
            $table->text('imageUrl')->nullable();
            $table->integer('unitPriceCents');
            $table->integer('quantity');
            $table->integer('lineTotalCents');

            $table->foreign('orderId')->references('id')->on('orders')->cascadeOnDelete();
            $table->foreign('productId')->references('id')->on('products')->nullOnDelete();
            $table->index('orderId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
