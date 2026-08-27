<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('email')->unique();
            $table->string('phone')->nullable()->unique();
            $table->string('passwordHash');
            $table->string('firstName');
            $table->string('lastName');
            $table->enum('role', ['CUSTOMER', 'BUSINESS_OWNER', 'DEALER', 'ADMIN'])->default('CUSTOMER');
            $table->enum('status', ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'])->default('PENDING_VERIFICATION');
            $table->json('privileges')->nullable();
            $table->integer('points')->default(0);
            $table->string('avatarUrl')->nullable();
            $table->timestamp('emailVerifiedAt')->nullable();
            $table->uuid('createdById')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('createdById')->references('id')->on('users')->nullOnDelete();
            $table->index('role');
            $table->index('createdById');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
