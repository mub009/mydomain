<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// A QR board's destination (and a scan's, and a shop's default) was a fixed
// list in the database; boards can now also open the business's AI Google
// Review and One Review pages. Plain text from here on — the app checks the
// allowed values (App\Support\ReviewChannels::ALL), so a new destination
// needs no migration.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('review_qr_codes', fn (Blueprint $table) => $table->string('channel', 30)->nullable()->change());
        Schema::table('review_scans', fn (Blueprint $table) => $table->string('channel', 30)->change());
        Schema::table('businesses', fn (Blueprint $table) => $table->string('preferredReviewChannel', 30)->nullable()->change());
    }

    public function down(): void
    {
        $old = ['GOOGLE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WEBSITE', 'DIRECTIONS', 'MARKKITO', 'MARKKITO_REVIEW'];
        Schema::table('review_qr_codes', fn (Blueprint $table) => $table->enum('channel', $old)->nullable()->change());
        Schema::table('review_scans', fn (Blueprint $table) => $table->enum('channel', $old)->change());
        Schema::table('businesses', fn (Blueprint $table) => $table->enum('preferredReviewChannel', $old)->nullable()->change());
    }
};
