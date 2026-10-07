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
        Schema::create('releves', function (Blueprint $table) {
    $table->id();
    $table->foreignId('compteur_id')->constrained()->cascadeOnDelete();
    $table->dateTime('releve_le');                 // un relevé par heure
    $table->decimal('energie_kwh', 10, 3);         // produite ou consommée selon le compteur
    $table->timestamps();

    $table->unique(['compteur_id', 'releve_le']);
    $table->index('releve_le');
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('releves');
    }
};
