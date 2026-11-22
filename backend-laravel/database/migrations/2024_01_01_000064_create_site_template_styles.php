<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // An admin's CSS override for one website template (App\Support\SiteBuilder\TemplateRegistry),
    // applied on top of that template's own generated styles for every business using it.
    public function up(): void
    {
        Schema::create('site_template_styles', function (Blueprint $table) {
            $table->string('templateId')->primary();
            $table->longText('customCss')->nullable();
            $table->uuid('updatedByUserId')->nullable();
            $table->timestamp('updatedAt')->nullable();

            $table->foreign('updatedByUserId')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_template_styles');
    }
};
