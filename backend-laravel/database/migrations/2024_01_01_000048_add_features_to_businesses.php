<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // What a dealer gives a business, a point each (App\Support\BusinessFeatures):
    // its website on a subdomain, the digital visiting card, gold-rate posters.
    // businesses.features null = every feature (listings from before features,
    // and those an admin or the owner made). point_transactions.feature says
    // which feature a point was spent on or returned for.
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->json('features')->nullable();
        });
        Schema::table('point_transactions', function (Blueprint $table) {
            $table->string('feature', 30)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('businesses', fn (Blueprint $table) => $table->dropColumn('features'));
        Schema::table('point_transactions', fn (Blueprint $table) => $table->dropColumn('feature'));
    }
};
