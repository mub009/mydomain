<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // A dealer who deletes a listing they paid for gets the point back
    // (App\Support\Points::refundForBusiness), recorded as BUSINESS_DELETED.
    public function up(): void
    {
        Schema::table('point_transactions', function (Blueprint $table) {
            $table->enum('type', ['ADMIN_GRANT', 'ADMIN_DEDUCTION', 'BUSINESS_CREATED', 'BUSINESS_DELETED'])->change();
        });
    }

    public function down(): void
    {
        Schema::table('point_transactions', function (Blueprint $table) {
            $table->enum('type', ['ADMIN_GRANT', 'ADMIN_DEDUCTION', 'BUSINESS_CREATED'])->change();
        });
    }
};
