<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offres', function (Blueprint $table) {
            $table->enum('source', ['solaire', 'eolien', 'hydraulique', 'biomasse'])
                ->default('solaire')
                ->after('prix_kwh');
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->decimal('commission', 12, 2)->default(0)->after('prix_total');
            $table->decimal('montant_net', 12, 2)->nullable()->after('commission');
        });

        // Anciennes transactions : pas de commission, le net égale le total.
        DB::table('transactions')->update(['montant_net' => DB::raw('prix_total')]);
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn(['commission', 'montant_net']);
        });

        Schema::table('offres', function (Blueprint $table) {
            $table->dropColumn('source');
        });
    }
};