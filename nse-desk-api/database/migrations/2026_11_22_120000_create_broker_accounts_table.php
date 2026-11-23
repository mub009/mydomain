<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per broker account a user has connected (e.g. their own Zerodha and
 * a family member's). The broker's access token is stored encrypted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('broker_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('broker', 20)->default('zerodha');
            $table->unsignedTinyInteger('app_slot')->default(1); // which Kite Connect app (KITE_API_KEY, _2 … _5)
            $table->string('client_id', 32);                     // the broker's user ID, e.g. AB1234
            $table->string('name')->nullable();
            $table->text('access_token');                        // encrypted
            $table->timestamp('expires_at');                     // Kite sessions end at 06:00 IST
            $table->timestamps();
            $table->unique(['user_id', 'broker', 'client_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('broker_accounts');
    }
};
