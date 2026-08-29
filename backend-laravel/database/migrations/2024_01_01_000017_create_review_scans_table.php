<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('review_scans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('businessId');
            $table->uuid('qrCodeId')->nullable();
            $table->enum('channel', [
                'GOOGLE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WEBSITE', 'DIRECTIONS', 'MARKKITO', 'MARKKITO_REVIEW',
            ]);
            $table->text('userAgent')->nullable();
            $table->timestamp('scannedAt')->nullable();

            $table->foreign('businessId')->references('id')->on('businesses')->cascadeOnDelete();
            $table->foreign('qrCodeId')->references('id')->on('review_qr_codes')->nullOnDelete();
            $table->index(['businessId', 'scannedAt']);
            $table->index('qrCodeId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_scans');
    }
};
