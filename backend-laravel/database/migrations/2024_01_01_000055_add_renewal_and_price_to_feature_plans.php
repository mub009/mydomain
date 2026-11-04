<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Feature pricing (App\Support\FeaturePlans) gets separate renewal points
    // (what each renewal of a timed feature costs) and a price in rupees,
    // shown to dealers for reference. Renewal starts at today's points.
    public function up(): void
    {
        Schema::table('feature_plans', function (Blueprint $table) {
            $table->unsignedInteger('renewalPoints')->default(1);
            $table->unsignedInteger('priceInr')->nullable();
        });
        DB::table('feature_plans')->update(['renewalPoints' => DB::raw('points')]);
    }

    public function down(): void
    {
        Schema::table('feature_plans', fn (Blueprint $table) => $table->dropColumn(['renewalPoints', 'priceInr']));
    }
};
