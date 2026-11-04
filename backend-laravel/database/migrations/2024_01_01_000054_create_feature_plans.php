<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Feature pricing (App\Support\FeaturePlans): what the admin charges a
    // dealer for each feature, in points, and for how long — 1, 3, 6 or 12
    // months, or unlimited (null). A timed feature's end date is kept per
    // business in businesses.featureExpiry; the dealer renews it for the
    // same points (FEATURE_RENEWED). point_transactions.durationMonths marks
    // a timed purchase, which is never refunded.
    public function up(): void
    {
        Schema::create('feature_plans', function (Blueprint $table) {
            $table->string('feature', 40)->primary();
            $table->unsignedInteger('points')->default(1);
            $table->unsignedTinyInteger('durationMonths')->nullable();
        });
        // Today's prices: a point each, unlimited.
        foreach (['WEBSITE', 'VISITING_CARD', 'GOLD_RATE', 'AI_REVIEW', 'ONE_REVIEW'] as $feature) {
            DB::table('feature_plans')->insert(['feature' => $feature, 'points' => 1, 'durationMonths' => null]);
        }

        Schema::table('businesses', function (Blueprint $table) {
            $table->json('featureExpiry')->nullable();
        });

        Schema::table('point_transactions', function (Blueprint $table) {
            $table->enum('type', ['ADMIN_GRANT', 'ADMIN_DEDUCTION', 'BUSINESS_CREATED', 'BUSINESS_DELETED', 'FEATURE_ADDED', 'FEATURE_REMOVED', 'FEATURE_RENEWED'])->change();
            $table->unsignedTinyInteger('durationMonths')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('point_transactions', function (Blueprint $table) {
            $table->dropColumn('durationMonths');
        });
        Schema::table('point_transactions', function (Blueprint $table) {
            $table->enum('type', ['ADMIN_GRANT', 'ADMIN_DEDUCTION', 'BUSINESS_CREATED', 'BUSINESS_DELETED', 'FEATURE_ADDED', 'FEATURE_REMOVED'])->change();
        });
        Schema::table('businesses', fn (Blueprint $table) => $table->dropColumn('featureExpiry'));
        Schema::dropIfExists('feature_plans');
    }
};
