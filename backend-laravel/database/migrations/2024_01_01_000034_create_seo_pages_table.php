<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Every public page we want in Google (a business's listing page and its
    // website), when we last asked Google to crawl it, and what Google last
    // said about it. Kept up to date by App\Support\Seo\SeoTracker and the
    // `seo:sync` command.
    public function up(): void
    {
        Schema::create('seo_pages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('businessId');
            // LISTING (/business/<slug>) or WEBSITE (the subdomain or /site/<slug>).
            $table->string('kind', 10);
            $table->string('url', 500);
            // Set whenever the page is new or changed; `seo:sync` submits it
            // to Google and clears it.
            $table->boolean('needsSubmit')->default(true);
            $table->timestamp('firstSubmittedAt')->nullable();
            $table->timestamp('submittedAt')->nullable();
            $table->unsignedInteger('submitCount')->default(0);
            $table->string('submitError', 500)->nullable();
            // UNKNOWN until checked, then INDEXED / NOT_INDEXED / ERROR.
            $table->string('indexStatus', 12)->default('UNKNOWN');
            // Google's own words, e.g. "Submitted and indexed" or
            // "Discovered - currently not indexed".
            $table->string('coverageState', 150)->nullable();
            $table->timestamp('lastCrawledAt')->nullable();
            $table->timestamp('checkedAt')->nullable();
            $table->timestamp('indexedAt')->nullable();
            $table->timestamp('createdAt')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->unique(['businessId', 'kind']);
            $table->index('indexStatus');
            $table->index('needsSubmit');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seo_pages');
    }
};
