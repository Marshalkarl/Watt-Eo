<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\OffreController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\DashboardController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Publiques : la carte doit pouvoir afficher les offres
Route::get('/offres', [OffreController::class, 'index']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/mes-offres', [OffreController::class, 'mesOffres']);
    Route::post('/offres', [OffreController::class, 'store']);
    Route::put('/offres/{offre}', [OffreController::class, 'update']);
    Route::delete('/offres/{offre}', [OffreController::class, 'destroy']);

    Route::post('/offres/{offre}/acheter', [TransactionController::class, 'acheter']);
    Route::get('/mes-achats', [TransactionController::class, 'mesAchats']);
    Route::get('/mes-ventes', [TransactionController::class, 'mesVentes']);
    Route::post('/recharger', [TransactionController::class, 'recharger']);

    Route::get('/dashboard', [DashboardController::class, 'index']);
});

// Placée après /mes-offres pour éviter tout conflit de route
Route::get('/offres/{offre}', [OffreController::class, 'show']);