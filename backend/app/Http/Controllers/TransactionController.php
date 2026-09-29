<?php

namespace App\Http\Controllers;

use App\Models\Offre;
use App\Models\Transaction;
use App\Models\User;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransactionController extends Controller
{
    /**
     * Achat de kWh sur une offre (consommateurs uniquement).
     */
    public function acheter(Request $request, Offre $offre): JsonResponse
    {
        if ($request->user()->role !== 'consommateur') {
            return response()->json(
                ['message' => 'Seuls les consommateurs peuvent acheter de l\'énergie.'],
                403
            );
        }

        $data = $request->validate([
            'quantite_kwh' => ['required', 'numeric', 'gt:0'],
        ]);

        $quantite = (float) $data['quantite_kwh'];
        $acheteurId = $request->user()->id;

        try {
            $transaction = DB::transaction(function () use ($offre, $acheteurId, $quantite) {
                // Verrous pour éviter qu'un même stock ou solde soit utilisé deux fois
                $offre      = Offre::whereKey($offre->id)->lockForUpdate()->firstOrFail();
                $acheteur   = User::whereKey($acheteurId)->lockForUpdate()->firstOrFail();
                $producteur = User::whereKey($offre->producteur_id)->lockForUpdate()->firstOrFail();

                if ($producteur->id === $acheteur->id) {
                    throw new DomainException('Vous ne pouvez pas acheter votre propre offre.');
                }
                if (!$offre->disponible) {
                    throw new DomainException('Cette offre n\'est plus disponible.');
                }
                if ($quantite > $offre->quantite_kwh) {
                    throw new DomainException('Quantité demandée supérieure au stock de l\'offre.');
                }

                $total = round($quantite * $offre->prix_kwh, 2);

                if ($acheteur->credits < $total) {
                    throw new DomainException('Crédits insuffisants.');
                }

                $acheteur->decrement('credits', $total);
                $producteur->increment('credits', $total);

                $reste = round($offre->quantite_kwh - $quantite, 3);
                $offre->update([
                    'quantite_kwh' => $reste,
                    'disponible'   => $reste > 0,
                ]);

                return Transaction::create([
                    'offre_id'        => $offre->id,
                    'consommateur_id' => $acheteur->id,
                    'quantite_kwh'    => $quantite,
                    'prix_total'      => $total,
                    'statut'          => 'confirmee',
                ]);
            });
        } catch (DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($transaction->load('offre'), 201);
    }

    /**
     * Historique des achats du consommateur connecté.
     */
    public function mesAchats(Request $request): JsonResponse
    {
        return response()->json(
            $request->user()->achats()->with('offre')->latest()->get()
        );
    }

    /**
     * Historique des ventes du producteur connecté.
     */
    public function mesVentes(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        return response()->json(
            Transaction::whereHas('offre', fn ($q) => $q->where('producteur_id', $userId))
                ->with('consommateur:id,name')
                ->latest()
                ->get()
        );
    }

    /**
     * Recharge SIMULÉE de crédits (démo uniquement).
     */
    public function recharger(Request $request): JsonResponse
    {
        $data = $request->validate([
            'montant' => ['required', 'numeric', 'gt:0', 'max:1000000'],
        ]);

        $user = $request->user();
        $user->increment('credits', $data['montant']);

        return response()->json(['credits' => $user->refresh()->credits]);
    }
}