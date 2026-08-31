<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // One thread per (listing, buyer) pair — a seller with 5 interested
    // buyers on the same item gets 5 separate conversations, each showing
    // only that buyer's messages, mirroring how OLX/marketplace apps do it.
    public function up(): void
    {
        Schema::create('classified_conversations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('listingId');
            $table->uuid('buyerId');
            // Denormalized so the seller's inbox can filter/sort without a
            // join through classified_listings on every request.
            $table->uuid('sellerId');
            $table->timestamp('lastMessageAt')->nullable();
            $table->timestamp('buyerLastReadAt')->nullable();
            $table->timestamp('sellerLastReadAt')->nullable();
            $table->timestamp('createdAt')->nullable();

            $table->foreign('listingId')->references('id')->on('classified_listings')->cascadeOnDelete();
            $table->foreign('buyerId')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('sellerId')->references('id')->on('users')->cascadeOnDelete();
            $table->unique(['listingId', 'buyerId']);
            $table->index('sellerId');
            $table->index('buyerId');
            $table->index('lastMessageAt');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classified_conversations');
    }
};
