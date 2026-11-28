<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Zerodha holdings and positions are saved, so they stay visible after the
 * daily session ends; each refresh replaces them (sold stocks are removed).
 * Plus each user's watchlist.
 */
return new class extends Migration
{
    public function up(): void
    {
        // A session that has ended keeps the account (and its saved holdings) with no token.
        Schema::table('broker_accounts', function (Blueprint $table) {
            $table->text('access_token')->nullable()->change();
            $table->timestamp('expires_at')->nullable()->change();
            $table->timestamp('synced_at')->nullable()->after('expires_at');
        });

        Schema::create('broker_holdings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broker_account_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 10);                 // holding | position
            $table->string('symbol', 40);
            $table->string('exchange', 10);
            $table->string('product', 10)->default(''); // positions: CNC / MIS / NRML
            $table->integer('qty');
            $table->decimal('avg_price', 16, 4);
            $table->decimal('last_price', 16, 4);
            $table->decimal('close_price', 16, 4)->nullable();
            $table->decimal('pnl', 18, 2)->default(0);
            $table->decimal('m2m', 18, 2)->nullable();
            $table->decimal('day_change_pct', 8, 2)->nullable();
            $table->timestamps();
            $table->unique(['broker_account_id', 'kind', 'exchange', 'symbol', 'product'], 'broker_holdings_unique');
        });

        Schema::create('watchlist_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('symbol', 20);
            $table->string('note', 200)->nullable();
            $table->decimal('added_price', 16, 4)->nullable(); // price when added, to show the move since
            $table->timestamps();
            $table->unique(['user_id', 'symbol']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('watchlist_items');
        Schema::dropIfExists('broker_holdings');
        Schema::table('broker_accounts', function (Blueprint $table) {
            $table->dropColumn('synced_at');
        });
    }
};
