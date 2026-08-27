<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('point_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('userId');
            $table->enum('type', ['ADMIN_GRANT', 'ADMIN_DEDUCTION', 'BUSINESS_CREATED']);
            $table->integer('amount');
            $table->integer('balanceAfter');
            $table->text('note')->nullable();
            $table->uuid('businessId')->nullable();
            $table->uuid('grantedById')->nullable();
            $table->timestamp('createdAt')->nullable();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('grantedById')->references('id')->on('users')->nullOnDelete();
            $table->index(['userId', 'createdAt']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('point_transactions');
    }
};
