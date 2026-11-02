<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // A dealer adds a business with just its name, category and location,
    // and fills in the phone and address later from the business's Manage
    // page — so both can be empty until then.
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->string('phone')->nullable()->change();
            $table->string('addressLine1')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->string('phone')->nullable(false)->default('')->change();
            $table->string('addressLine1')->nullable(false)->default('')->change();
        });
    }
};
