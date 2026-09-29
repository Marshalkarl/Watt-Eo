<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    Schema::create('transactions', function (Blueprint $table) {
        $table->id();
        $table->foreignId('offre_id')->constrained('offres')->cascadeOnDelete();
        $table->foreignId('consommateur_id')->constrained('users')->cascadeOnDelete();
        $table->decimal('quantite_kwh', 10, 2);
        $table->decimal('prix_total', 10, 2);
        $table->enum('statut', ['en_attente', 'confirmee', 'annulee'])->default('en_attente');
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
