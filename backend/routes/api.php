<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\OffreController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\CompteurController;
use App\Http\Controllers\EnergieController;
use App\Http\Controllers\MarcheController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\ProfilController;

Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

// Publiques : la carte doit pouvoir afficher les offres
Route::get('/offres', [OffreController::class, 'index']);

Route::middleware(['auth:sanctum', 'actif'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/profil', [ProfilController::class, 'update'])->middleware('throttle:ecriture');
    Route::put('/profil/mot-de-passe', [ProfilController::class, 'changerMotDePasse'])->middleware('throttle:profil');
    Route::delete('/profil', [ProfilController::class, 'supprimer'])->middleware('throttle:profil');

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/tout-lire', [NotificationController::class, 'toutLire']);
    Route::post('/notifications/{id}/lue', [NotificationController::class, 'lire']);

    Route::get('/mes-offres', [OffreController::class, 'mesOffres']);
    Route::post('/offres', [OffreController::class, 'store'])->middleware('throttle:ecriture');
    Route::put('/offres/{offre}', [OffreController::class, 'update'])->middleware('throttle:ecriture');
    Route::delete('/offres/{offre}', [OffreController::class, 'destroy'])->middleware('throttle:ecriture');

    Route::post('/offres/{offre}/acheter', [TransactionController::class, 'acheter'])->middleware('throttle:achat');
    Route::post('/transactions/{transaction}/confirmer', [TransactionController::class, 'confirmer'])->middleware('throttle:transaction');
    Route::post('/transactions/{transaction}/refuser', [TransactionController::class, 'refuser'])->middleware('throttle:transaction');
    Route::post('/transactions/{transaction}/annuler', [TransactionController::class, 'annuler'])->middleware('throttle:transaction');
    Route::get('/commandes-en-attente', [TransactionController::class, 'commandesEnAttente']);
    Route::get('/mes-achats', [TransactionController::class, 'mesAchats']);
    Route::get('/mes-ventes', [TransactionController::class, 'mesVentes']);
    Route::get('/mes-mouvements', [TransactionController::class, 'mesMouvements']);
    Route::post('/recharger', [TransactionController::class, 'recharger'])->middleware('throttle:recharge');
    Route::get('/transactions/{transaction}/recu', [TransactionController::class, 'recu']);
    Route::get('/transactions/export', [TransactionController::class, 'exporter']);
    Route::get('/rapport-mensuel', [TransactionController::class, 'rapportMensuel']);

    Route::get('/dashboard', [DashboardController::class, 'index']);

    Route::get('/compteurs', [CompteurController::class, 'index']);
    Route::post('/compteurs', [CompteurController::class, 'store']);
    Route::delete('/compteurs/{compteur}', [CompteurController::class, 'destroy']);
    Route::get('/compteurs/{compteur}/releves', [CompteurController::class, 'releves']);
    Route::post('/compteurs/{compteur}/recharger', [CompteurController::class, 'recharger']);
    Route::get('/energie/bilan', [EnergieController::class, 'bilan']);
});

// Placée après /mes-offres pour éviter tout conflit de route
Route::get('/offres/{offre}', [OffreController::class, 'show']);
// Route::get('/marche', [MarcheController::class, 'index']);
Route::get('/marche/prix', [MarcheController::class, 'prix']);

Route::middleware(['auth:sanctum', 'actif', 'admin'])->prefix('admin')->group(function () {
    Route::get('/ping', fn () => response()->json(['ok' => true]));
    Route::get('/dashboard', [AdminController::class, 'dashboard']);

    Route::get('/utilisateurs', [AdminController::class, 'utilisateurs']);
    Route::post('/utilisateurs/{user}/suspendre', [AdminController::class, 'suspendre']);
    Route::post('/utilisateurs/{user}/reactiver', [AdminController::class, 'reactiver']);

    Route::get('/transactions', [AdminController::class, 'transactions']);

    Route::get('/offres', [AdminController::class, 'offres']);
    Route::post('/offres/{offre}/retirer', [AdminController::class, 'retirerOffre']);
    Route::post('/offres/{offre}/remettre', [AdminController::class, 'remettreOffre']);

    Route::get('/journal', [AdminController::class, 'journal']);
});