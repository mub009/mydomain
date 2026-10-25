<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // What the owner wants Google to show for the listing and website (the
    // SEO section of the dashboard). Null falls back to the name, city and
    // description — see App\Support\Seo\SeoMeta.
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->string('seoTitle', 70)->nullable()->after('description');
            $table->string('seoDescription', 170)->nullable()->after('seoTitle');
            $table->string('seoKeywords', 255)->nullable()->after('seoDescription');
        });
    }

    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->dropColumn(['seoTitle', 'seoDescription', 'seoKeywords']);
        });
    }
};
