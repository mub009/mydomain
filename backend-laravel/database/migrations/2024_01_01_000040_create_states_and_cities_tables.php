<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // The State and City drop-downs on the business forms. Filled by
    // Database\Seeders\StateCitySeeder (database/data/india-states-cities.php).
    // Businesses still store the names as text, so a town that isn't
    // listed can be typed in ("Other").
    public function up(): void
    {
        Schema::create('states', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 50)->unique();
            $table->string('code', 5)->nullable();
            $table->string('country', 2)->default('IN');
        });

        Schema::create('cities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('stateId');
            $table->string('name', 100);

            $table->unique(['stateId', 'name']);
            $table->foreign('stateId')->references('id')->on('states')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cities');
        Schema::dropIfExists('states');
    }
};
