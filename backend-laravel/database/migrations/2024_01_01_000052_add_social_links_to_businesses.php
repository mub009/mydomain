<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // App\Support\SocialLinks: TikTok, X, LinkedIn, Snapchat, Threads,
    // Pinterest and Telegram profiles, as { network: username or link }.
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->json('socialLinks')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('businesses', fn (Blueprint $table) => $table->dropColumn('socialLinks'));
    }
};
