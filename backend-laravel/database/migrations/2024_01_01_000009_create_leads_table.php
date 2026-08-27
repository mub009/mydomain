<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('businessId');
            $table->uuid('customerId')->nullable();
            $table->string('name');
            $table->string('phone');
            $table->string('email')->nullable();
            $table->text('message')->nullable();
            $table->enum('source', ['SEARCH', 'BUSINESS_PROFILE', 'CALLBACK_REQUEST', 'QUOTE_REQUEST', 'B2B_RFQ'])->default('SEARCH');
            $table->enum('status', ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'])->default('NEW');
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('businessId')->references('id')->on('businesses')->cascadeOnDelete();
            $table->foreign('customerId')->references('id')->on('users')->nullOnDelete();
            $table->index(['businessId', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
