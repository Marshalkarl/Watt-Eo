<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role === 'admin') {
            return response()->json(['message' => 'Utilisez le tableau de bord administrateur.'], 403);
        }
        $jours = in_array((int) $request->query('jours', 30), [7, 30, 90], true)
            ? (int) $request->query('jours', 30)
            : 30;

        return $user->role === 'producteur'
            ? $this->tableauProducteur($user, $jours)
            : $this->tableauConsommateur($user, $jours);
    }

    /**
     * Regroupe par jour et complète les jours sans transaction avec 0.
     * $colonneTotal : expression SQL sommée pour le champ « total »
     * (valeur fixe définie dans le code, jamais issue de la requête).
     */
    private function evolutionParJour($requete, int $jours, string $colonneTotal = 'prix_total'): array
    {
        $debut = now()->subDays($jours - 1)->startOfDay();

        $parJour = $requete
            ->where('created_at', '>=', $debut)
            ->selectRaw("DATE(created_at) as jour, SUM(quantite_kwh) as kwh, SUM({$colonneTotal}) as total")
            ->groupBy('jour')
            ->orderBy('jour')
            ->get()
            ->keyBy('jour');

        $resultat = [];
        foreach (CarbonPeriod::create($debut, now()->startOfDay()) as $date) {
            $cle = $date->format('Y-m-d');
            $ligne = $parJour->get($cle);

            $resultat[] = [
                'jour'  => $cle,
                'kwh'   => $ligne ? (float) $ligne->kwh : 0.0,
                'total' => $ligne ? (float) $ligne->total : 0.0,
            ];
        }

        return $resultat;
    }

    private function tableauProducteur($user, int $jours): JsonResponse
    {
        $ventes = fn () => Transaction::where('statut', 'confirmee')
            ->whereHas('offre', fn ($q) => $q->where('producteur_id', $user->id));

        $kwhVendus   = (float) $ventes()->sum('quantite_kwh');
        $revenus     = (float) $ventes()->sum(DB::raw('COALESCE(montant_net, prix_total)'));
        $commissions = (float) $ventes()->sum('commission');

        return response()->json([
            'role'                  => 'producteur',
            'credits'               => (float) $user->credits,
            'nombre_ventes'         => $ventes()->count(),
            'kwh_vendus'            => $kwhVendus,
            'revenus'               => $revenus,
            'commissions'           => $commissions,
            'offres_actives'        => $user->offres()->where('disponible', true)->count(),
            'kwh_en_vente'          => (float) $user->offres()->where('disponible', true)->sum('quantite_kwh'),
            'co2_evite_kg'          => round($kwhVendus * config('energie.facteur_co2_kg_kwh'), 2),
            'evolution_journaliere' => $this->evolutionParJour($ventes(), $jours, 'COALESCE(montant_net, prix_total)'),
        ]);
    }

    private function tableauConsommateur($user, int $jours): JsonResponse
    {
        $achats = fn () => $user->achats()->where('statut', 'confirmee');

        $kwhAchetes = (float) $achats()->sum('quantite_kwh');
        $depenses   = (float) $achats()->sum('prix_total');

        return response()->json([
            'role'                  => 'consommateur',
            'credits'               => (float) $user->credits,
            'nombre_achats'         => $achats()->count(),
            'kwh_achetes'           => $kwhAchetes,
            'depenses'              => $depenses,
            'economies'             => round($kwhAchetes * config('energie.tarif_reseau_kwh') - $depenses, 2),
            'co2_evite_kg'          => round($kwhAchetes * config('energie.facteur_co2_kg_kwh'), 2),
            'evolution_journaliere' => $this->evolutionParJour($achats(), $jours),
        ]);
    }
}