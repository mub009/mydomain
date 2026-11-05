<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // "Multi card view": the public /card/<slug> link shows the business's
    // card and then other ready-made designs, as a slider.
    // extraTemplateIds: which designs follow it; null = every image design
    // offered for the business's category.
    public function up(): void
    {
        Schema::table('business_cards', function (Blueprint $table) {
            $table->boolean('multiView')->default(false)->after('isPublished');
            $table->json('extraTemplateIds')->nullable()->after('multiView');
        });
    }

    public function down(): void
    {
        Schema::table('business_cards', fn (Blueprint $table) => $table->dropColumn(['multiView', 'extraTemplateIds']));
    }
};
