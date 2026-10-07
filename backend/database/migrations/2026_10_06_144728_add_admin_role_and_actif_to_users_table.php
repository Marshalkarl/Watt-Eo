<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY role ENUM('producteur','consommateur','admin') NOT NULL DEFAULT 'consommateur'");

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

        DB::statement("ALTER TABLE users MODIFY role ENUM('producteur','consommateur') NOT NULL DEFAULT 'consommateur'");
    }
};