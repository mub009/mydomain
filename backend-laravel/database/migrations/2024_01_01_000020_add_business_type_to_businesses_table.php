<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // B2C (public customers) vs B2B (other businesses/suppliers) — a label
    // for discovery and filtering, not a different feature set. B2B
    // businesses are ordinary listings that show up in the same search and
    // detail pages as B2C ones, just filterable by this.
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->enum('businessType', ['B2C', 'B2B'])->default('B2C')->after('subscriptionPlan');
            $table->index('businessType');
        });
    }

    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->dropIndex(['businessType']);
            $table->dropColumn('businessType');
        });
    }
};
