<?php

namespace App\Http\Controllers;

use App\Models\MouvementCredit;
use App\Models\Offre;
use App\Models\Transaction;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use App\Models\AuditLog;

class TransactionController extends Controller
{
    /**
     * Achat de kWh (consommateurs uniquement). Crée une commande EN ATTENTE
     * et met les crédits de l'acheteur en séquestre.
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
            'quantite_kwh' => ['required', 'numeric', 'gt:0', 'max:100000', 'decimal:0,3'],
        ]);

        // Protection contre le double clic / la requête répétée (3 secondes)
        if (!Cache::add("achat-en-cours:{$request->user()->id}:{$offre->id}", true, 3)) {
            return response()->json(
                ['message' => 'Un achat est déjà en cours sur cette offre. Patientez quelques secondes.'],
                429
            );
        }

        $quantite   = (float) $data['quantite_kwh'];
        $acheteurId = $request->user()->id;

        try {
            $transaction = DB::transaction(function () use ($offre, $acheteurId, $quantite) {
                $offre    = Offre::whereKey($offre->id)->lockForUpdate()->firstOrFail();
                $acheteur = User::whereKey($acheteurId)->lockForUpdate()->firstOrFail();

                if ($offre->producteur_id === $acheteur->id) {
                    throw new DomainException('Vous ne pouvez pas acheter votre propre offre.');
                }

                $producteur = User::find($offre->producteur_id);
                if (!$producteur || !$producteur->actif) {
                    throw new DomainException('Ce producteur n\'est plus disponible.');
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

                $reste = round($offre->quantite_kwh - $quantite, 3);
                $offre->update([
                    'quantite_kwh' => $reste,
                    'disponible'   => $reste > 0,
                ]);

                $transaction = Transaction::create([
                    'offre_id'        => $offre->id,
                    'consommateur_id' => $acheteur->id,
                    'quantite_kwh'    => $quantite,
                    'prix_total'      => $total,
                    'statut'          => 'en_attente',
                ]);

                MouvementCredit::enregistrer(
                    $acheteur,
                    'achat',
                    -$total,
                    "Achat en attente — offre #{$offre->id}",
                    $transaction->id,
                );

                return $transaction;
            });
        } catch (DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($transaction->load('offre.producteur:id,name'), 201);

                AuditLog::enregistrer($request->user(), 'achat', $transaction, [
            'quantite_kwh' => $quantite,
            'prix_total'   => $transaction->prix_total,
        ]);
    }

    /**
     * Le producteur confirme la commande : les crédits en séquestre lui sont
     * versés, moins la commission de la plateforme.
     */
    public function confirmer(Request $request, Transaction $transaction): JsonResponse
    {
        return $this->traiterDecision($request, $transaction, 'confirmer');
    }

    /**
     * Le producteur refuse la commande : l'acheteur est remboursé et le stock restitué.
     */
    public function refuser(Request $request, Transaction $transaction): JsonResponse
    {
        $data = $request->validate(['motif' => ['nullable', 'string', 'max:255']]);

        return $this->traiterDecision($request, $transaction, 'refuser', $data['motif'] ?? null);
    }

    /**
     * L'acheteur annule sa propre commande tant qu'elle est en attente.
     */
    public function annuler(Request $request, Transaction $transaction): JsonResponse
    {
        if ($transaction->consommateur_id !== $request->user()->id) {
            return response()->json(['message' => 'Action non autorisée.'], 403);
        }

        return $this->traiterDecision($request, $transaction, 'annuler', 'Annulée par l\'acheteur');
    }

    /**
     * $action : 'confirmer' | 'refuser' (producteur) ou 'annuler' (acheteur).
     */
    private function traiterDecision(Request $request, Transaction $transaction, string $action, ?string $motif = null): JsonResponse
    {
        try {
            $transaction = DB::transaction(function () use ($request, $transaction, $action, $motif) {
                $transaction = Transaction::whereKey($transaction->id)->lockForUpdate()->firstOrFail();
                $offre       = Offre::whereKey($transaction->offre_id)->lockForUpdate()->firstOrFail();

                $estProducteur = $offre->producteur_id === $request->user()->id;
                $estAcheteur   = $transaction->consommateur_id === $request->user()->id;

                if (in_array($action, ['confirmer', 'refuser'], true) && !$estProducteur) {
                    throw new DomainException('Seul le producteur peut traiter cette commande.');
                }
                if ($action === 'annuler' && !$estAcheteur) {
                    throw new DomainException('Action non autorisée.');
                }

                if ($transaction->statut !== 'en_attente') {
                    throw new DomainException('Cette commande a déjà été traitée.');
                }

                if ($action === 'confirmer') {
                    $producteur = User::whereKey($offre->producteur_id)->lockForUpdate()->firstOrFail();

                    // Commission de la plateforme, figée au moment de la confirmation
                    $commissionPct = (float) config('energie.commission_pct', 0);
                    $commission    = round($transaction->prix_total * $commissionPct / 100, 2);
                    $montantNet    = round($transaction->prix_total - $commission, 2);

                    MouvementCredit::enregistrer(
                        $producteur,
                        'vente',
                        $montantNet,
                        "Vente confirmée — offre #{$offre->id}"
                            . ($commission > 0 ? " (commission : {$commission})" : ''),
                        $transaction->id,
                    );

                    $transaction->update([
                        'statut'      => 'confirmee',
                        'commission'  => $commission,
                        'montant_net' => $montantNet,
                    ]);
                } else {
                    $acheteur = User::whereKey($transaction->consommateur_id)->lockForUpdate()->firstOrFail();

                    MouvementCredit::enregistrer(
                        $acheteur,
                        'remboursement',
                        $transaction->prix_total,
                        $motif ?? 'Commande refusée',
                        $transaction->id,
                    );

                    $offre->update([
                        'quantite_kwh' => round($offre->quantite_kwh + $transaction->quantite_kwh, 3),
                        'disponible'   => true,
                    ]);

                    $transaction->update([
                        'statut'      => 'annulee',
                        'motif_refus' => $motif,
                    ]);
                }

                return $transaction;
            });
        } catch (DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

                $actions = [
            'confirmer' => 'commande_confirmee',
            'refuser'   => 'commande_refusee',
            'annuler'   => 'commande_annulee',
        ];

        AuditLog::enregistrer($request->user(), $actions[$action], $transaction, array_filter([
            'prix_total' => $transaction->prix_total,
            'commission' => $transaction->commission,
            'motif'      => $motif,
        ]));

        return response()->json($transaction->fresh(['offre', 'consommateur:id,name']));
    }

    /**
     * Commandes en attente pour les offres du producteur connecté.
     */
    public function commandesEnAttente(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        return response()->json(
            Transaction::whereHas('offre', fn ($q) => $q->where('producteur_id', $userId))
                ->where('statut', 'en_attente')
                ->with(['offre', 'consommateur:id,name'])
                ->latest()
                ->get()
        );
    }

    public function mesAchats(Request $request): JsonResponse
    {
        return response()->json(
            $request->user()->achats()->with('offre.producteur:id,name')->latest()->get()
        );
    }

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
     * Journal des mouvements de crédits de l'utilisateur connecté.
     */
    public function mesMouvements(Request $request): JsonResponse
    {
        return response()->json(
            $request->user()->mouvementsCredits()->latest()->limit(100)->get()
        );
    }

    /**
     * Recharge SIMULÉE de crédits (démo uniquement).
     */
     public function recharger(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'consommateur') {
            return response()->json(
                ['message' => 'Seuls les consommateurs peuvent recharger leur compte.'],
                403
            );
        }

        $maxUnitaire = (float) config('energie.recharge_max', 100000);
        $maxJour     = (float) config('energie.recharge_max_jour', 500000);

        $data = $request->validate([
            'montant' => ['required', 'numeric', 'gt:0', "max:$maxUnitaire", 'decimal:0,2'],
        ], [
            'montant.max' => 'Le montant maximum par recharge est de '
                . number_format($maxUnitaire, 0, ',', ' ') . ' crédits.',
        ]);

        $montant = (float) $data['montant'];

        try {
            DB::transaction(function () use ($user, $montant, $maxJour) {
                // Verrou sur le compte : deux recharges simultanées ne contournent pas le plafond
                User::whereKey($user->id)->lockForUpdate()->firstOrFail();

                $dejaRecharge = (float) $user->mouvementsCredits()
                    ->where('type', 'recharge')
                    ->where('created_at', '>=', now()->startOfDay())
                    ->sum('montant');

                if ($dejaRecharge + $montant > $maxJour) {
                    throw new DomainException(
                        'Plafond journalier de recharge atteint ('
                        . number_format($maxJour, 0, ',', ' ') . ' crédits par jour).'
                    );
                }

                MouvementCredit::enregistrer($user, 'recharge', $montant, 'Recharge simulée');
            });
        } catch (DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        AuditLog::enregistrer($user, 'recharge', null, ['montant' => $montant]);

        return response()->json(['credits' => $user->refresh()->credits]);
    }
    /**
     * Reçu PDF d'une commande confirmée (acheteur ou producteur concerné).
     */
    public function recu(Request $request, Transaction $transaction)
    {
        $transaction->load([
            'offre.producteur:id,name',
            'consommateur:id,name',
        ]);

        $userId = $request->user()->id;

        $estProducteur = (int) $transaction->offre?->producteur_id === (int) $userId;
        $estAcheteur   = (int) $transaction->consommateur_id === (int) $userId;

        if (! $estProducteur && ! $estAcheteur) {
            return response()->json(['message' => 'Action non autorisée.'], 403);
        }

        if ($transaction->statut !== 'confirmee') {
            return response()->json([
                'message' => 'Le reçu n’est disponible que pour une commande confirmée.',
            ], 422);
        }

        $pdf = Pdf::loadView('pdf.recu', compact('transaction', 'estProducteur'));

        return $pdf->download("recu-transaction-{$transaction->id}.pdf");
    }
}