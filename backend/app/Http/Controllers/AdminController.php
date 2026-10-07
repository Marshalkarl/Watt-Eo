<?php

namespace App\Http\Controllers;

use App\Models\Offre;
use App\Models\Transaction;
use App\Models\User;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\AuditLog;

class AdminController extends Controller
{
    /**
     * Vue d'ensemble de la plateforme.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $jours = in_array((int) $request->query('jours', 30), [7, 30, 90], true)
            ? (int) $request->query('jours', 30)
            : 30;

        $confirmees = fn () => Transaction::where('statut', 'confirmee');

        $kwhEchanges = (float) $confirmees()->sum('quantite_kwh');

        $parStatut = Transaction::selectRaw('statut, COUNT(*) as nombre')
            ->groupBy('statut')
            ->pluck('nombre', 'statut');

        $parSource = Transaction::where('transactions.statut', 'confirmee')
            ->join('offres', 'offres.id', '=', 'transactions.offre_id')
            ->selectRaw('offres.source as source, SUM(transactions.quantite_kwh) as kwh')
            ->groupBy('offres.source')
            ->pluck('kwh', 'source')
            ->map(fn ($v) => (float) $v);

        return response()->json([
            'utilisateurs' => [
                'producteurs'   => User::where('role', 'producteur')->count(),
                'consommateurs' => User::where('role', 'consommateur')->count(),
                'suspendus'     => User::where('actif', false)->count(),
            ],
            'offres' => [
                'total'   => Offre::count(),
                'actives' => Offre::where('disponible', true)->where('quantite_kwh', '>', 0)->count(),
            ],
            'transactions' => [
                'en_attente' => (int) ($parStatut['en_attente'] ?? 0),
                'confirmees' => (int) ($parStatut['confirmee'] ?? 0),
                'annulees'   => (int) ($parStatut['annulee'] ?? 0),
            ],
            'kwh_echanges'          => $kwhEchanges,
            'volume_credits'        => (float) $confirmees()->sum('prix_total'),
            'commissions_totales'   => (float) $confirmees()->sum('commission'),
            'co2_evite_kg'          => round($kwhEchanges * config('energie.facteur_co2_kg_kwh'), 2),
            'kwh_par_source'        => $parSource,
            'evolution_journaliere' => $this->evolution($jours),
        ]);
    }

    /**
     * Activité de la plateforme jour par jour (jours sans activité = 0).
     */
    private function evolution(int $jours): array
    {
        $debut = now()->subDays($jours - 1)->startOfDay();

        $parJour = Transaction::where('statut', 'confirmee')
            ->where('created_at', '>=', $debut)
            ->selectRaw('DATE(created_at) as jour, COUNT(*) as nombre, SUM(quantite_kwh) as kwh, SUM(prix_total) as volume, SUM(commission) as commissions')
            ->groupBy('jour')
            ->orderBy('jour')
            ->get()
            ->keyBy('jour');

        $resultat = [];
        foreach (CarbonPeriod::create($debut, now()->startOfDay()) as $date) {
            $cle   = $date->format('Y-m-d');
            $ligne = $parJour->get($cle);

            $resultat[] = [
                'jour'        => $cle,
                'nombre'      => $ligne ? (int) $ligne->nombre : 0,
                'kwh'         => $ligne ? (float) $ligne->kwh : 0.0,
                'volume'      => $ligne ? (float) $ligne->volume : 0.0,
                'commissions' => $ligne ? (float) $ligne->commissions : 0.0,
            ];
        }

        return $resultat;
    }
        /**
     * Liste des utilisateurs (filtres : role, actif=1/0, q = nom ou email).
     */
    public function utilisateurs(Request $request): JsonResponse
    {
        $data = $request->validate([
            'role'  => ['nullable', 'in:producteur,consommateur,admin'],
            'actif' => ['nullable', 'boolean'],
            'q'     => ['nullable', 'string', 'max:100'],
        ]);

        $query = User::select('id', 'name', 'email', 'role', 'actif', 'credits', 'created_at')->latest();

        if (!empty($data['role'])) {
            $query->where('role', $data['role']);
        }
        if ($request->has('actif') && $request->query('actif') !== '') {
            $query->where('actif', $request->boolean('actif'));
        }
        if (!empty($data['q'])) {
            $q = $data['q'];
            $query->where(fn ($w) => $w->where('name', 'like', "%{$q}%")
                ->orWhere('email', 'like', "%{$q}%"));
        }

        return response()->json($query->paginate(20));
    }

    /**
     * Toutes les transactions de la plateforme (filtre : statut).
     */
    public function transactions(Request $request): JsonResponse
    {
        $data = $request->validate([
            'statut' => ['nullable', 'in:en_attente,confirmee,annulee'],
        ]);

        $query = Transaction::with([
            'offre:id,producteur_id,source,prix_kwh',
            'offre.producteur:id,name',
            'consommateur:id,name',
        ])->latest();

        if (!empty($data['statut'])) {
            $query->where('statut', $data['statut']);
        }

        return response()->json($query->paginate(20));
    }

    /**
     * Toutes les offres (filtre : retirees=1 pour voir les offres retirées).
     */
    public function offres(Request $request): JsonResponse
    {
        $query = Offre::with('producteur:id,name')->latest();

        if ($request->boolean('retirees')) {
            $query->where('retiree', true);
        }

        return response()->json($query->paginate(20));
    }

        public function suspendre(Request $request, User $user): JsonResponse
    {
        if ($user->role === 'admin') {
            return response()->json(['message' => 'Un administrateur ne peut pas être suspendu.'], 422);
        }

        $user->forceFill(['actif' => false])->save();
        $user->tokens()->delete();

        AuditLog::enregistrer($request->user(), 'compte_suspendu', $user);

        return response()->json($user->only(['id', 'name', 'email', 'role', 'actif']));
    }

    public function reactiver(Request $request, User $user): JsonResponse
    {
        $user->forceFill(['actif' => true])->save();

        AuditLog::enregistrer($request->user(), 'compte_reactive', $user);

        return response()->json($user->only(['id', 'name', 'email', 'role', 'actif']));
    }

    public function retirerOffre(Request $request, Offre $offre): JsonResponse
    {
        $data = $request->validate([
            'motif' => ['required', 'string', 'max:255'],
        ]);

        $offre->forceFill([
            'retiree'       => true,
            'motif_retrait' => $data['motif'],
            'disponible'    => false,
        ])->save();

        AuditLog::enregistrer($request->user(), 'offre_retiree', $offre, ['motif' => $data['motif']]);

        return response()->json($offre->refresh());
    }

    public function remettreOffre(Request $request, Offre $offre): JsonResponse
    {
        $offre->forceFill([
            'retiree'       => false,
            'motif_retrait' => null,
            'disponible'    => $offre->quantite_kwh > 0,
        ])->save();

        AuditLog::enregistrer($request->user(), 'offre_remise', $offre);

        return response()->json($offre->refresh());
    }

    /**
     * Journal d'audit (lecture seule). Filtres : action, user_id.
     */
    public function journal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action'  => ['nullable', 'string', 'max:60'],
            'user_id' => ['nullable', 'integer'],
        ]);

        $query = AuditLog::with('user:id,name,email,role')->orderByDesc('id');

        if (!empty($data['action'])) {
            $query->where('action', $data['action']);
        }
        if (!empty($data['user_id'])) {
            $query->where('user_id', $data['user_id']);
        }

        return response()->json($query->paginate(30));
    }

}