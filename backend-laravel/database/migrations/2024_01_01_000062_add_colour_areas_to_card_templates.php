<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Where the colour may go on a design's image, marked once by an admin in
// the template editor: every card wearing the design recolours only there
// (unless its own card has areas of its own). See ImageColour::areas.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('card_templates', function (Blueprint $table) {
            $table->json('colourAreas')->nullable()->after('hotspots');
        });
    }

    public function down(): void
    {
        Schema::table('card_templates', fn (Blueprint $table) => $table->dropColumn('colourAreas'));
    }
};
