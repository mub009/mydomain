<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // The admin's gold-rate poster maker (admin "Gold Rates" tab). Uploaded
    // template PNGs and logos are stored exactly as uploaded, on the private
    // local disk (App\Support\GoldRates\GoldRateFiles); the finished poster
    // is drawn in the browser and downloaded, never stored.
    public function up(): void
    {
        // Today's rate per purity, shared by every template.
        Schema::create('gold_rates', function (Blueprint $table) {
            $table->string('purity', 4)->primary();
            $table->decimal('rate', 12, 2)->nullable();
            $table->uuid('updatedById')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('updatedById')->references('id')->on('users')->nullOnDelete();
        });

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

        Schema::create('gold_rate_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 100);
            // The master PNG, never modified, and a small copy for the list.
            $table->string('imagePath', 255);
            $table->string('thumbPath', 255)->nullable();
            $table->unsignedInteger('imageWidth');
            $table->unsignedInteger('imageHeight');
            $table->uuid('logoId')->nullable();
            // Where the logo and each rate go, in the master's own pixels —
            // see App\Support\GoldRates\TemplateLayout.
            $table->json('layout');
            $table->uuid('createdById')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('logoId')->references('id')->on('gold_rate_logos')->nullOnDelete();
            $table->foreign('createdById')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gold_rate_templates');
        Schema::dropIfExists('gold_rate_logos');
        Schema::dropIfExists('gold_rates');
    }
};
