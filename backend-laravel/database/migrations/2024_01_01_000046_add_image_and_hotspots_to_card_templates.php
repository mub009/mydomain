<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Image templates: an admin uploads a card artwork and places actions on
    // it (App\Support\Cards\ImageCard). A business wearing the template shows
    // that image, each action linked to the business's own details, until
    // the business saves a customised copy on its own card.
    public function up(): void
    {
        Schema::table('card_templates', function (Blueprint $table) {
            $table->string('imageUrl', 500)->nullable()->after('backgroundImageUrl');
            $table->unsignedInteger('imageWidth')->nullable()->after('imageUrl');
            $table->unsignedInteger('imageHeight')->nullable()->after('imageWidth');
            $table->json('hotspots')->nullable()->after('imageHeight');
        });
    }

    public function down(): void
    {
        Schema::table('card_templates', fn (Blueprint $table) => $table->dropColumn(['imageUrl', 'imageWidth', 'imageHeight', 'hotspots']));
    }
};
