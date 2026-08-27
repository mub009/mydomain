<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('businesses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('ownerId');
            $table->uuid('createdById')->nullable();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->uuid('categoryId');
            $table->enum('status', ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'SUSPENDED'])->default('DRAFT');
            $table->enum('subscriptionPlan', ['FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE'])->default('FREE');

            $table->string('email')->nullable();
            $table->string('phone');
            $table->string('website')->nullable();
            $table->string('addressLine1');
            $table->string('addressLine2')->nullable();
            $table->string('city', 100);
            $table->string('state', 50);
            $table->string('postalCode');
            $table->string('country', 2)->default('IN');
            $table->double('latitude');
            $table->double('longitude');

            $table->string('googlePlaceId')->nullable();
            $table->text('googleReviewUrl')->nullable();
            $table->string('instagramUsername', 100)->nullable();
            $table->text('facebookPageUrl')->nullable();
            $table->text('youtubeUrl')->nullable();
            $table->enum('preferredReviewChannel', [
                'GOOGLE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WEBSITE', 'DIRECTIONS', 'MARKKITO', 'MARKKITO_REVIEW',
            ])->nullable();

            $table->string('logoUrl')->nullable();
            $table->string('coverImageUrl')->nullable();
            $table->boolean('isVerified')->default(false);
            $table->double('avgRating')->default(0);
            $table->integer('reviewCount')->default(0);
            $table->integer('leadCount')->default(0);
            $table->integer('viewCount')->default(0);

            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('ownerId')->references('id')->on('users');
            $table->foreign('createdById')->references('id')->on('users')->nullOnDelete();
            $table->foreign('categoryId')->references('id')->on('categories');
            $table->index('categoryId');
            $table->index(['city', 'state']);
            $table->index('status');
            $table->index('createdById');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('businesses');
    }
};
