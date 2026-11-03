<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // A dealer pays a point for each feature given to a business
    // (App\Support\Points::spendForFeature, FEATURE_ADDED) and gets it back
    // when the feature is taken away (FEATURE_REMOVED).
    public function up(): void
    {
        Schema::table('point_transactions', function (Blueprint $table) {
            $table->enum('type', ['ADMIN_GRANT', 'ADMIN_DEDUCTION', 'BUSINESS_CREATED', 'BUSINESS_DELETED', 'FEATURE_ADDED', 'FEATURE_REMOVED'])->change();
        });
    }

    public function down(): void
    {
        Schema::table('point_transactions', function (Blueprint $table) {
            $table->enum('type', ['ADMIN_GRANT', 'ADMIN_DEDUCTION', 'BUSINESS_CREATED', 'BUSINESS_DELETED'])->change();
        });
    }
};
