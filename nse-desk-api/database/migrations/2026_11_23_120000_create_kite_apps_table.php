<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Each user's own Kite Connect apps (from developers.kite.trade). The secret
 * is stored encrypted; broker accounts are connected through one of them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kite_apps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('label', 60)->nullable();
            $table->string('api_key', 64);
            $table->text('api_secret'); // encrypted
            $table->timestamps();
            $table->unique(['user_id', 'api_key']);
        });
        Schema::table('broker_accounts', function (Blueprint $table) {
            $table->foreignId('kite_app_id')->nullable()->after('user_id')->constrained('kite_apps')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('broker_accounts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('kite_app_id');
        });
        Schema::dropIfExists('kite_apps');
    }
};
