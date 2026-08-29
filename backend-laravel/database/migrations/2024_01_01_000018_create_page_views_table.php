<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('page_views', function (Blueprint $table) {
            $table->uuid('id')->primary();
            // Client-generated (localStorage), not a cookie/session id — lets
            // "online now" and "unique visitors" group hits from the same
            // browser without requiring an account.
            $table->string('visitorId', 64);
            $table->string('path', 500);
            $table->string('ip', 45);
            $table->string('city', 100)->nullable();
            $table->string('region', 100)->nullable();
            $table->string('country', 100)->nullable();
            $table->double('latitude')->nullable();
            $table->double('longitude')->nullable();
            $table->string('device', 20)->nullable();
            $table->string('browser', 30)->nullable();
            $table->string('referrer', 500)->nullable();
            $table->uuid('userId')->nullable();
            // Microsecond precision: "online now" orders by this to find a
            // visitor's latest page, and several page views (rapid SPA
            // navigation, a page load pinging alongside a background
            // fetch) can otherwise land in the same second with ties
            // broken arbitrarily rather than by actual recency.
            $table->timestamp('createdAt', 6);

            $table->index(['visitorId', 'createdAt']);
            $table->index('path');
            $table->index('createdAt');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('page_views');
    }
};
