<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Standard is now the design a new website starts from. Sites that only
    // exist because slider or gallery photos were uploaded never had a page
    // or a chosen design, so they move to it too; saved pages keep theirs.
    public function up(): void
    {
        Schema::table('business_sites', function (Blueprint $table) {
            $table->string('templateId', 40)->default('standard')->change();
        });

        DB::table('business_sites')
            ->where('templateId', 'classic')
            ->whereNull('html')
            ->whereNull('projectData')
            ->where('siteType', 'WEBSITE')
            ->update(['templateId' => 'standard']);
    }

    public function down(): void
    {
        Schema::table('business_sites', function (Blueprint $table) {
            $table->string('templateId', 40)->default('classic')->change();
        });
    }
};
