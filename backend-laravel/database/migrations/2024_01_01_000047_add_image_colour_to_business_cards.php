<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // The business's own recolouring of its card image — a tint, hue,
    // brightness and saturation (App\Support\Cards\ImageColour). Applied as
    // the card is drawn; the image itself is never changed.
    public function up(): void
    {
        Schema::table('business_cards', function (Blueprint $table) {
            $table->json('imageColour')->nullable()->after('hotspots');
        });
    }

    public function down(): void
    {
        Schema::table('business_cards', fn (Blueprint $table) => $table->dropColumn('imageColour'));
    }
};
