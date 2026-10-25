<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // The website's hero slider photos — their own set, separate from the
    // listing's photo gallery. Null means none yet.
    public function up(): void
    {
        Schema::table('business_sites', function (Blueprint $table) {
            $table->json('sliderImages')->nullable()->after('css');
        });
    }

    public function down(): void
    {
        Schema::table('business_sites', function (Blueprint $table) {
            $table->dropColumn('sliderImages');
        });
    }
};
