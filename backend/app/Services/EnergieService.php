<?php

namespace App\Services;

use App\Models\Compteur;
use App\Models\Offre;
use App\Models\Releve;
use App\Models\Transaction;
use App\Models\User;

class EnergieService
{
    public function aCompteurProduction(User $user): bool
    {
        return Compteur::where('user_id', $user->id)
            ->where('type', 'production')
            ->where('actif', true)
            ->exists();
    }

    public function bilan(User $user, int $jours = 30): array
    {
        $debut = now()->subDays($jours)->startOfDay();

        $somme = fn (string $type) => (float) Releve::whereHas(
                'compteur',
                fn ($q) => $q->where('user_id', $user->id)->where('type', $type)->where('actif', true)
            )
            ->where('releve_le', '>=', $debut)
            ->sum('energie_kwh');

        $production = $somme('production');
        $consommation = $somme('consommation');

        $vendu = (float) Transaction::where('statut', 'confirmee')
            ->where('created_at', '>=', $debut)
            ->whereHas('offre', fn ($q) => $q->where('producteur_id', $user->id))
            ->sum('quantite_kwh');

        // Commandes en attente : le stock de l'offre a déjà été décrémenté,
        // mais la vente n'est pas encore confirmée. Il faut les compter,
        // sinon le surplus est surestimé.
        $enAttente = (float) Transaction::where('statut', 'en_attente')
            ->where('created_at', '>=', $debut)
            ->whereHas('offre', fn ($q) => $q->where('producteur_id', $user->id))
            ->sum('quantite_kwh');

        $enVente = (float) Offre::where('producteur_id', $user->id)
            ->where('disponible', true)
            ->sum('quantite_kwh');

        $surplus = max(0, $production - $consommation - $vendu - $enAttente - $enVente);

        return [
            'periode_jours' => $jours,
            'production_kwh' => round($production, 2),
            'consommation_kwh' => round($consommation, 2),
            'vendu_kwh' => round($vendu, 2),
            'en_attente_kwh' => round($enAttente, 2),
            'en_vente_kwh' => round($enVente, 2),
            'surplus_kwh' => round($surplus, 2),
            'autosuffisance_pct' => $consommation > 0
                ? round(min(100, $production / $consommation * 100), 1)
                : null,
        ];
    }
}