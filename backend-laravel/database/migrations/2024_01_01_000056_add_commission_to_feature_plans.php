<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Feature pricing (App\Support\FeaturePlans): a renewal price and the
    // admin's commission in rupees, for a new sale and for a renewal. Each
    // dealer purchase records the price and commission it was made at, so
    // the dealer's "owed to admin" total never shifts when prices change.
    public function up(): void
    {
        Schema::table('feature_plans', function (Blueprint $table) {
            $table->unsignedInteger('renewalPriceInr')->nullable();
            $table->unsignedInteger('commissionInr')->nullable();
            $table->unsignedInteger('renewalCommissionInr')->nullable();
        });
        Schema::table('point_transactions', function (Blueprint $table) {
            $table->integer('priceInr')->nullable();
            // Negative on a refund, so the sum is what the dealer owes.
            $table->integer('commissionInr')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('point_transactions', fn (Blueprint $table) => $table->dropColumn(['priceInr', 'commissionInr']));
        Schema::table('feature_plans', fn (Blueprint $table) => $table->dropColumn(['renewalPriceInr', 'commissionInr', 'renewalCommissionInr']));
    }
};
