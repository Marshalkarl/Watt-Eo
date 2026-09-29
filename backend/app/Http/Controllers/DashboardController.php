<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return $user->role === 'producteur'
            ? $this->tableauProducteur($user)
            : $this->tableauConsommateur($user);
    }

    private function tableauProducteur($user): JsonResponse
    {
        $ventes = fn () => Transaction::where('statut', 'confirmee')
            ->whereHas('offre', fn ($q) => $q->where('producteur_id', $user->id));

        $kwhVendus = (float) $ventes()->sum('quantite_kwh');
        $revenus   = (float) $ventes()->sum('prix_total');

        $parMois = $ventes()
            ->where('created_at', '>=', now()->subMonths(11)->startOfMonth())
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as mois, SUM(quantite_kwh) as kwh, SUM(prix_total) as total")
            ->groupBy('mois')
            ->orderBy('mois')
            ->get()
            ->map(fn ($ligne) => [
                 'mois'  => $ligne->mois,
                 'kwh'   => (float) $ligne->kwh,
                 'total' => (float) $ligne->total,
            ]);

        return response()->json([
            'role'                => 'producteur',
            'credits'             => (float) $user->credits,
            'nombre_ventes'       => $ventes()->count(),
            'kwh_vendus'          => $kwhVendus,
            'revenus'             => $revenus,
            'offres_actives'      => $user->offres()->where('disponible', true)->count(),
            'kwh_en_vente'        => (float) $user->offres()->where('disponible', true)->sum('quantite_kwh'),
            'co2_evite_kg'        => round($kwhVendus * config('energie.facteur_co2_kg_kwh'), 2),
            'evolution_mensuelle' => $parMois,
        ]);
    }

    private function tableauConsommateur($user): JsonResponse
    {
        $achats = fn () => $user->achats()->where('statut', 'confirmee');

        $kwhAchetes = (float) $achats()->sum('quantite_kwh');
        $depenses   = (float) $achats()->sum('prix_total');

        $parMois = $achats()
            ->where('created_at', '>=', now()->subMonths(11)->startOfMonth())
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as mois, SUM(quantite_kwh) as kwh, SUM(prix_total) as total")
            ->groupBy('mois')
            ->orderBy('mois')
            ->get()
            ->map(fn ($ligne) => [
                 'mois'  => $ligne->mois,
                 'kwh'   => (float) $ligne->kwh,
                 'total' => (float) $ligne->total,
            ]);

        return response()->json([
            'role'                => 'consommateur',
            'credits'             => (float) $user->credits,
            'nombre_achats'       => $achats()->count(),
            'kwh_achetes'         => $kwhAchetes,
            'depenses'            => $depenses,
            'economies'           => round($kwhAchetes * config('energie.tarif_reseau_kwh') - $depenses, 2),
            'co2_evite_kg'        => round($kwhAchetes * config('energie.facteur_co2_kg_kwh'), 2),
            'evolution_mensuelle' => $parMois,
        ]);
    }
}