<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('review_qr_codes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 20)->unique();
            $table->enum('status', ['UNASSIGNED', 'ASSIGNED', 'DISABLED'])->default('UNASSIGNED');
            $table->enum('channel', [
                'GOOGLE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WEBSITE', 'DIRECTIONS', 'MARKKITO', 'MARKKITO_REVIEW',
            ])->nullable();
            $table->string('batchLabel', 100)->nullable();
            $table->uuid('businessId')->nullable();
            $table->timestamp('assignedAt')->nullable();
            // Not a foreign key in the source schema either — the assigning
            // user is recorded for reference only.
            $table->uuid('assignedById')->nullable();
            $table->integer('scanCount')->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('businessId')->references('id')->on('businesses')->nullOnDelete();
            $table->index('status');
            $table->index('businessId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_qr_codes');
    }
};
