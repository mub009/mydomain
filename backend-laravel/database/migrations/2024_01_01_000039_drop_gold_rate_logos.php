<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    // A gold-rate poster's logo is now always its linked business's own, so
    // the uploaded logo library goes, with its stored files.
    public function up(): void
    {
        Schema::table('gold_rate_templates', function (Blueprint $table) {
            $table->dropForeign(['logoId']);
            $table->dropColumn('logoId');
        });
        Schema::dropIfExists('gold_rate_logos');
        Storage::disk('local')->deleteDirectory('gold-rates/logos');
    }

    // The table comes back empty; the deleted files can't be restored.
    public function down(): void
    {
        Schema::create('gold_rate_logos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 100);
            $table->string('path', 255);
            $table->string('mime', 20);
            $table->unsignedInteger('width');
            $table->unsignedInteger('height');
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();
        });
        Schema::table('gold_rate_templates', function (Blueprint $table) {
            $table->uuid('logoId')->nullable()->after('imageHeight');
            $table->foreign('logoId')->references('id')->on('gold_rate_logos')->nullOnDelete();
        });
    }
};
