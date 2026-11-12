<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Colour versions of a design: the admin uploads the same design in other
// colours, each with its swatch (card_templates.colourVariants:
// [{id, colour, imageUrl, imageWidth, imageHeight}]); a card picks one on
// its open card (business_cards.colourVariantId) and wears that image.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('card_templates', function (Blueprint $table) {
            $table->json('colourVariants')->nullable()->after('colourAreas');
        });
        Schema::table('business_cards', function (Blueprint $table) {
            $table->string('colourVariantId', 40)->nullable()->after('imageColour');
        });
    }

    public function down(): void
    {
        Schema::table('card_templates', fn (Blueprint $table) => $table->dropColumn('colourVariants'));
        Schema::table('business_cards', fn (Blueprint $table) => $table->dropColumn('colourVariantId'));
    }
};
