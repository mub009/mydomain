<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Digital visiting cards. The design lives in card_templates and the
    // business's own details stay on the businesses row: business_cards only
    // records which design a business picked and whether its card is live,
    // so switching templates never touches the name, logo, phone, etc.
    // (App\Support\Cards\CardEngine renders one through the other).
    public function up(): void
    {
        Schema::create('card_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            // Null = a general template, offered to categories with too few of their own.
            $table->uuid('categoryId')->nullable();
            $table->string('name', 80);
            $table->string('slug', 100)->unique();
            $table->string('layout', 20);
            $table->string('backgroundImageUrl', 500)->nullable();
            // Colours, fonts, button style — see CardEngine::normalizeDesign().
            $table->json('design');
            $table->boolean('isDefault')->default(false);
            $table->boolean('isActive')->default(true);
            $table->boolean('isPremium')->default(false);
            $table->unsignedInteger('sortOrder')->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('categoryId')->references('id')->on('categories')->cascadeOnDelete();
            $table->index(['categoryId', 'isActive', 'sortOrder']);
        });

        Schema::create('business_cards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('businessId')->unique();
            // Null (or a template since deleted) falls back to the category default.
            $table->uuid('templateId')->nullable();
            $table->boolean('isPublished')->default(false);
            $table->timestamp('publishedAt')->nullable();
            $table->unsignedInteger('viewCount')->default(0);
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('businessId')->references('id')->on('businesses')->cascadeOnDelete();
            $table->foreign('templateId')->references('id')->on('card_templates')->nullOnDelete();
        });

        // The card's WhatsApp button. Falls back to the phone when empty.
        Schema::table('businesses', function (Blueprint $table) {
            $table->string('whatsappNumber', 20)->nullable()->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('businesses', fn (Blueprint $table) => $table->dropColumn('whatsappNumber'));
        Schema::dropIfExists('business_cards');
        Schema::dropIfExists('card_templates');
    }
};
