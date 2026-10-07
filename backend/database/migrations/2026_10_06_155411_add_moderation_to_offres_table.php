<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offres', function (Blueprint $table) {
            $table->boolean('retiree')->default(false)->after('disponible');
            $table->string('motif_retrait')->nullable()->after('retiree');
        });
    }

    public function down(): void
    {
        Schema::table('offres', function (Blueprint $table) {
            $table->dropColumn(['retiree', 'motif_retrait']);
        });
    }
};