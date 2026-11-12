<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// The colours a business may recolour a design in, chosen by the admin per
// design (["#rrggbb", …]); none = the standard swatches.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('card_templates', function (Blueprint $table) {
            $table->json('colourChoices')->nullable()->after('colourVariants');
        });
    }

    public function down(): void
    {
        Schema::table('card_templates', fn (Blueprint $table) => $table->dropColumn('colourChoices'));
    }
};
