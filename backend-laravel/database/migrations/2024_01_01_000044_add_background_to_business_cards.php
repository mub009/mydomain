<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // A business's own card background (an AI-made one, typically). It
    // belongs to the business's card, not to a template, so it stays when
    // the business switches designs; empty = the template's own background.
    public function up(): void
    {
        Schema::table('business_cards', function (Blueprint $table) {
            $table->string('backgroundImageUrl', 500)->nullable()->after('templateId');
        });
    }

    public function down(): void
    {
        Schema::table('business_cards', fn (Blueprint $table) => $table->dropColumn('backgroundImageUrl'));
    }
};
