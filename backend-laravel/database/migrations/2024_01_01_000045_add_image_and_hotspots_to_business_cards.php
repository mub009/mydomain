<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // An image card: the business uploads its own card artwork (a JPG) and
    // places tappable actions on it — Call, WhatsApp, Directions, … — as
    // rectangles in percent of the image (App\Support\Cards\ImageCard).
    // With an image set, the card shows it instead of a template.
    public function up(): void
    {
        Schema::table('business_cards', function (Blueprint $table) {
            $table->string('imageUrl', 500)->nullable()->after('backgroundImageUrl');
            $table->unsignedInteger('imageWidth')->nullable()->after('imageUrl');
            $table->unsignedInteger('imageHeight')->nullable()->after('imageWidth');
            $table->json('hotspots')->nullable()->after('imageHeight');
        });
    }

    public function down(): void
    {
        Schema::table('business_cards', fn (Blueprint $table) => $table->dropColumn(['imageUrl', 'imageWidth', 'imageHeight', 'hotspots']));
    }
};
