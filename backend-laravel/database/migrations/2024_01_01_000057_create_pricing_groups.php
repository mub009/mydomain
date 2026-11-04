<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    // Pricing groups (App\Support\FeaturePlans): feature pricing is set per
    // group, and each dealer is in one (users.pricingGroupId). A dealer in
    // no group, or in a deleted one, pays the default group's prices.
    // Today's prices become the "Default" group's.
    public function up(): void
    {
        Schema::create('pricing_groups', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 80);
            $table->boolean('isDefault')->default(false);
            $table->timestamp('createdAt')->nullable();
        });
        $defaultId = (string) Str::uuid();
        DB::table('pricing_groups')->insert(['id' => $defaultId, 'name' => 'Default', 'isDefault' => true, 'createdAt' => now()]);

        Schema::create('feature_plan_prices', function (Blueprint $table) {
            $table->id();
            $table->uuid('groupId');
            $table->string('feature', 40);
            $table->unsignedInteger('points')->default(1);
            $table->unsignedInteger('renewalPoints')->default(1);
            $table->unsignedInteger('priceInr')->nullable();
            $table->unsignedInteger('renewalPriceInr')->nullable();
            $table->unsignedInteger('commissionInr')->nullable();
            $table->unsignedInteger('renewalCommissionInr')->nullable();
            $table->unsignedTinyInteger('durationMonths')->nullable();
            $table->unique(['groupId', 'feature']);
            $table->foreign('groupId')->references('id')->on('pricing_groups')->cascadeOnDelete();
        });
        foreach (DB::table('feature_plans')->get() as $row) {
            DB::table('feature_plan_prices')->insert([
                'groupId' => $defaultId, 'feature' => $row->feature, 'points' => $row->points, 'renewalPoints' => $row->renewalPoints,
                'priceInr' => $row->priceInr, 'renewalPriceInr' => $row->renewalPriceInr, 'commissionInr' => $row->commissionInr,
                'renewalCommissionInr' => $row->renewalCommissionInr, 'durationMonths' => $row->durationMonths,
            ]);
        }
        Schema::dropIfExists('feature_plans');

        Schema::table('users', function (Blueprint $table) {
            $table->uuid('pricingGroupId')->nullable();
            $table->foreign('pricingGroupId')->references('id')->on('pricing_groups')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['pricingGroupId']);
            $table->dropColumn('pricingGroupId');
        });
        Schema::create('feature_plans', function (Blueprint $table) {
            $table->string('feature', 40)->primary();
            $table->unsignedInteger('points')->default(1);
            $table->unsignedTinyInteger('durationMonths')->nullable();
            $table->unsignedInteger('renewalPoints')->default(1);
            $table->unsignedInteger('priceInr')->nullable();
            $table->unsignedInteger('renewalPriceInr')->nullable();
            $table->unsignedInteger('commissionInr')->nullable();
            $table->unsignedInteger('renewalCommissionInr')->nullable();
        });
        $defaultId = DB::table('pricing_groups')->where('isDefault', true)->value('id');
        foreach (DB::table('feature_plan_prices')->where('groupId', $defaultId)->get() as $row) {
            DB::table('feature_plans')->insert([
                'feature' => $row->feature, 'points' => $row->points, 'durationMonths' => $row->durationMonths, 'renewalPoints' => $row->renewalPoints,
                'priceInr' => $row->priceInr, 'renewalPriceInr' => $row->renewalPriceInr, 'commissionInr' => $row->commissionInr,
                'renewalCommissionInr' => $row->renewalCommissionInr,
            ]);
        }
        Schema::dropIfExists('feature_plan_prices');
        Schema::dropIfExists('pricing_groups');
    }
};
