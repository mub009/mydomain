<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // The website's "Our Gallery" photos — their own set, separate from the
    // listing's photos and the slider. Null means none yet.
    public function up(): void
    {
        Schema::table('business_sites', function (Blueprint $table) {
            $table->json('galleryImages')->nullable()->after('sliderImages');
        });
    }

    public function down(): void
    {
        Schema::table('business_sites', function (Blueprint $table) {
            $table->dropColumn('galleryImages');
        });
    }
};
