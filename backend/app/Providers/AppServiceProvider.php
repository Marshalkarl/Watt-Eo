<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $trop = fn (string $message) => fn (Request $request, array $headers) =>
            response()->json(['message' => $message], 429, $headers);

        // Les limites des opérations sensibles sont comptées par utilisateur connecté (sinon par IP)
        $cle = fn (Request $request) => (string) ($request->user()?->id ?: $request->ip());

        // Toutes les routes de l'API : 120 requêtes par minute
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by(
            $request->bearerToken() ? sha1($request->bearerToken()) : $request->ip()
        ));

        // Connexion : 5 essais par minute pour un même email depuis une même adresse
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)
                ->by(strtolower((string) $request->input('email')).'|'.$request->ip())
                ->response($trop('Trop de tentatives de connexion. Réessayez dans une minute.')),
            Limit::perMinute(20)
                ->by($request->ip())
                ->response($trop('Trop de tentatives depuis cette adresse. Réessayez dans une minute.')),
        ]);

        // Inscription : 20 comptes par heure et par adresse
        RateLimiter::for('register', fn (Request $request) => Limit::perHour(20)
            ->by($request->ip())
            ->response($trop('Trop d’inscriptions depuis cette adresse. Réessayez plus tard.')));

        // Achats : 10 par minute
        RateLimiter::for('achat', fn (Request $request) => Limit::perMinute(10)
            ->by($cle($request))
            ->response($trop('Trop d’achats en peu de temps. Patientez une minute.')));

        // Confirmer, refuser, annuler une commande : 30 par minute
        RateLimiter::for('transaction', fn (Request $request) => Limit::perMinute(30)
            ->by($cle($request))
            ->response($trop('Trop d’actions sur les commandes. Patientez une minute.')));

        // Recharges de crédits : 5 par minute
        RateLimiter::for('recharge', fn (Request $request) => Limit::perMinute(5)
            ->by($cle($request))
            ->response($trop('Trop de recharges en peu de temps. Patientez une minute.')));

        // Création, modification, suppression d'offres : 20 par minute
        RateLimiter::for('ecriture', fn (Request $request) => Limit::perMinute(20)
            ->by($cle($request))
            ->response($trop('Trop de modifications en peu de temps. Patientez une minute.')));
        
        RateLimiter::for('profil', fn (Request $request) =>
        Limit::perMinute(5)->by($request->user()?->id ?: $request->ip())
        );
    }
}