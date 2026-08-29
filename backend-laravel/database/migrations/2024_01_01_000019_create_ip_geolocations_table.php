<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // A cache in front of the free IP-geolocation API — city/country for an
    // IP rarely changes, and the free tier is rate-limited, so every IP is
    // looked up once and reused from here after that.
    public function up(): void
    {
        Schema::create('ip_geolocations', function (Blueprint $table) {
            $table->string('ip', 45)->primary();
            $table->string('city', 100)->nullable();
            $table->string('region', 100)->nullable();
            $table->string('country', 100)->nullable();
            $table->double('latitude')->nullable();
            $table->double('longitude')->nullable();
            $table->timestamp('lookedUpAt');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ip_geolocations');
    }
};
