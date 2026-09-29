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
    Schema::create('offres', function (Blueprint $table) {
        $table->id();
        $table->foreignId('producteur_id')->constrained('users')->cascadeOnDelete();
        $table->decimal('quantite_kwh', 10, 2);
        $table->decimal('prix_kwh', 8, 2);
        $table->decimal('latitude', 10, 7);
        $table->decimal('longitude', 10, 7);
        $table->boolean('disponible')->default(true);
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('offres');
    }
};
