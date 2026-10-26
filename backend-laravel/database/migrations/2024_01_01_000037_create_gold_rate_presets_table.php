<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Rate-box designs the admin saved from the editor ("Save as preset"),
    // offered next to the built-in presets on every template. The style's
    // sizes are fractions of the box height — see
    // App\Support\GoldRates\TemplateLayout::presetRules().
    public function up(): void
    {
        Schema::create('gold_rate_presets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 60);
            $table->json('style');
            $table->uuid('createdById')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('createdById')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gold_rate_presets');
    }
};
