<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Who generated a QR board: an admin, or a dealer generating boards for the
// shops they sign up (a dealer's QR Boards list shows the boards they made).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('review_qr_codes', function (Blueprint $table) {
            $table->uuid('createdById')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('review_qr_codes', function (Blueprint $table) {
            $table->dropIndex(['createdById']);
            $table->dropColumn('createdById');
        });
    }
};
