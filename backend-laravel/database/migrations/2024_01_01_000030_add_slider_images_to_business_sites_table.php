<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Photos the owner picked for the website's hero slider. Null means
    // "use the listing's own photos".
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
