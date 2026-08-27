<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('business_sites', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('businessId')->unique();
            $table->enum('siteType', ['WEBSITE', 'ECOMMERCE'])->default('WEBSITE');
            $table->string('templateId', 40)->default('classic');
            $table->json('projectData')->nullable();
            $table->longText('html')->nullable();
            $table->longText('css')->nullable();
            $table->boolean('isPublished')->default(false);
            $table->timestamp('publishedAt')->nullable();

            $table->integer('deliveryFeeCents')->default(0);
            $table->integer('freeDeliveryAboveCents')->nullable();
            $table->boolean('acceptsOnlinePayment')->default(false);

            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('businessId')->references('id')->on('businesses')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_sites');
    }
};
