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
        Schema::create('compteurs', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('nom');
    $table->enum('type', ['production', 'consommation']);
    $table->string('source')->nullable();          // solaire, eolien, hydraulique, biomasse
    $table->decimal('puissance_kwc', 8, 2)->nullable();
    $table->boolean('actif')->default(true);
    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('compteurs');
    }
};
