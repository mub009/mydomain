<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// A "common" card design is offered to every category, alongside each
// category's own designs (a plain general one only tops up a category that
// has few designs of its own).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('card_templates', function (Blueprint $table) {
            $table->boolean('isCommon')->default(false)->after('categoryId');
        });
    }

    public function down(): void
    {
        Schema::table('card_templates', function (Blueprint $table) {
            $table->dropColumn('isCommon');
        });
    }
};
