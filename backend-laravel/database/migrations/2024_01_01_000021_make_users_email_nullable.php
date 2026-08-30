<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // A business login handed out by a dealer may only have a phone number —
    // email is no longer the sole username.
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            // SQLite (used by the test suite) has no ALTER COLUMN; rebuilding
            // the table via the schema builder needs doctrine/dbal, which
            // isn't installed, so recreate the column definition directly.
            Schema::table('users', function (Blueprint $table) {
                $table->string('email_tmp')->nullable();
            });
            DB::statement('UPDATE users SET email_tmp = email');
            Schema::table('users', function (Blueprint $table) {
                $table->dropUnique('users_email_unique');
                $table->dropColumn('email');
            });
            Schema::table('users', function (Blueprint $table) {
                $table->renameColumn('email_tmp', 'email');
            });
            Schema::table('users', function (Blueprint $table) {
                $table->unique('email');
            });

            return;
        }

        DB::statement('ALTER TABLE users MODIFY email VARCHAR(255) NULL');
    }

    public function down(): void
    {
        DB::statement("UPDATE users SET email = CONCAT('user-', id, '@unknown.local') WHERE email IS NULL");

        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement('ALTER TABLE users MODIFY email VARCHAR(255) NOT NULL');
    }
};
