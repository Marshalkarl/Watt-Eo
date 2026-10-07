<?php

namespace App\Http\Controllers;

use App\Models\Offre;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\MarcheController;


class MarcheController extends Controller
{
    /**
     * Repères de prix du marché (publique) : limites, prix moyen pondéré,
     * prix suggéré et économie par rapport au réseau.
     */
    public function prix(): JsonResponse
    {
        $tarif    = (float) config('energie.tarif_reseau_kwh');
        $plancher = (float) config('energie.prix_plancher_kwh');

        $stats = Offre::where('disponible', true)
            ->where('quantite_kwh', '>', 0)
            ->selectRaw('
                COUNT(*) as nb,
                COALESCE(SUM(quantite_kwh), 0) as kwh,
                MIN(prix_kwh) as prix_min,
                MAX(prix_kwh) as prix_max,
                SUM(prix_kwh * quantite_kwh) / NULLIF(SUM(quantite_kwh), 0) as prix_moyen
            ')
            ->first();

        $moyen = $stats->prix_moyen !== null ? round((float) $stats->prix_moyen, 2) : null;

        // Sans offre sur le marché, on suggère 70 % du tarif réseau.
        $suggere = $moyen ?? round($tarif * 0.7, 2);
        $suggere = min($tarif, max($plancher, $suggere));

        return response()->json([
            'tarif_reseau_kwh'  => $tarif,
            'prix_plancher_kwh' => $plancher,
            'prix_plafond_kwh'  => $tarif,
            'offres_disponibles' => (int) $stats->nb,
            'kwh_disponibles'   => round((float) $stats->kwh, 2),
            'prix_min'          => $stats->prix_min !== null ? (float) $stats->prix_min : null,
            'prix_max'          => $stats->prix_max !== null ? (float) $stats->prix_max : null,
            'prix_moyen'        => $moyen,
            'prix_suggere'      => round($suggere, 2),
            'economie_pct'      => $moyen !== null && $tarif > 0
                ? round((1 - $moyen / $tarif) * 100, 1)
                : null,
        ]);
    }
}