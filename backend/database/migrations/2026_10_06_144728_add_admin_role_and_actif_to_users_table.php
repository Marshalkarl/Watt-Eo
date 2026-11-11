<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role::text IN ('producteur','consommateur','admin'))");
        } else {
            DB::statement("ALTER TABLE users MODIFY role ENUM('producteur','consommateur','admin') NOT NULL DEFAULT 'consommateur'");
        }

        Schema::table('users', function (Blueprint $table) {
            $table->boolean('actif')->default(true)->after('credits');
        });
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'admin')->update(['role' => 'consommateur']);

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('actif');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role::text IN ('producteur','consommateur'))");
        } else {
            DB::statement("ALTER TABLE users MODIFY role ENUM('producteur','consommateur') NOT NULL DEFAULT 'consommateur'");
        }
    }
};