<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Commission the admin has received from a dealer (App\Support\Commission).
    // What the dealer still owes is their commission (point_transactions)
    // minus these. Refunds now also record the price taken back, so
    // "collected" stays net of refunds.
    public function up(): void
    {
        Schema::create('commission_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('dealerId');
            $table->unsignedInteger('amountInr');
            $table->date('paidOn');
            $table->string('note', 300)->nullable();
            $table->uuid('receivedById')->nullable();
            $table->timestamp('createdAt')->nullable();

            $table->foreign('dealerId')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('receivedById')->references('id')->on('users')->nullOnDelete();
            $table->index(['dealerId', 'paidOn']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commission_payments');
    }
};
