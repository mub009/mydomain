<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // The business forms no longer ask for a postal code; existing values
    // are kept and still shown in the address where present.
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->string('postalCode')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->string('postalCode')->nullable(false)->default('')->change();
        });
    }
};
