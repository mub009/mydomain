<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // The business a gold-rate template is for: its logo and details
    // (name, phone, address, QR code…) can be placed on the poster, and stay
    // current with the business (App\Support\GoldRates\BusinessCard).
    public function up(): void
    {
        Schema::table('gold_rate_templates', function (Blueprint $table) {
            $table->uuid('businessId')->nullable()->after('logoId');
            $table->foreign('businessId')->references('id')->on('businesses')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('gold_rate_templates', function (Blueprint $table) {
            $table->dropForeign(['businessId']);
            $table->dropColumn('businessId');
        });
    }
};
