<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classified_listings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('sellerId');
            $table->uuid('categoryId');
            $table->string('title');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->enum('condition', ['NEW', 'USED']);
            $table->unsignedBigInteger('priceCents');
            $table->string('currency', 3)->default('INR');
            // ACTIVE is the default on create — like OLX, a listing goes live
            // immediately; admins moderate reactively (REMOVED) rather than
            // gating every post behind a pre-approval queue.
            $table->enum('status', ['ACTIVE', 'SOLD', 'PAUSED', 'EXPIRED', 'REMOVED'])->default('ACTIVE');

            $table->string('city', 100);
            $table->string('state', 50)->nullable();
            $table->string('country', 2)->default('IN');
            $table->double('latitude')->nullable();
            $table->double('longitude')->nullable();

            $table->string('contactPhone', 20);
            $table->boolean('whatsappEnabled')->default(false);
            $table->string('whatsappNumber', 20)->nullable();

            $table->integer('viewCount')->default(0);
            $table->integer('favoriteCount')->default(0);

            // Sort anchor for "renew" — bumping a listing back to the top of
            // search results without touching its original createdAt.
            $table->timestamp('bumpedAt')->nullable();
            $table->timestamp('expiresAt')->nullable();
            $table->timestamp('soldAt')->nullable();

            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('sellerId')->references('id')->on('users');
            $table->foreign('categoryId')->references('id')->on('classified_categories');
            $table->index('sellerId');
            $table->index('categoryId');
            $table->index('status');
            $table->index(['city', 'state']);
            $table->index('bumpedAt');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classified_listings');
    }
};
