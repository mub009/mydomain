<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classified_reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('listingId');
            $table->uuid('reporterId');
            $table->enum('reason', ['PROHIBITED_ITEM', 'SCAM_FRAUD', 'INAPPROPRIATE', 'SPAM', 'OTHER']);
            $table->text('message')->nullable();
            $table->enum('status', ['PENDING', 'REVIEWED', 'DISMISSED'])->default('PENDING');
            $table->timestamp('createdAt')->nullable();

            $table->foreign('listingId')->references('id')->on('classified_listings')->cascadeOnDelete();
            $table->foreign('reporterId')->references('id')->on('users')->cascadeOnDelete();
            $table->index('listingId');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classified_reports');
    }
};
