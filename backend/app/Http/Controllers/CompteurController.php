<?php

namespace App\Http\Controllers;

use App\Models\Compteur;
use App\Models\Releve;
use App\Services\EnergieService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

class CompteurController extends Controller
{
    public function index(Request $request)
    {
        return $request->user()->compteurs()->orderBy('id')->get();
    }

   public function store(Request $request)
{
    $data = $request->validate([
        'nom' => 'required|string|max:100',
        'type' => 'required|in:production,consommation',
        'source' => 'required_if:type,production|nullable|in:solaire,eolien,hydraulique,biomasse',
        'puissance_kwc' => 'required_if:type,production|nullable|numeric|min:0.1|max:10000',
    ]);

    if ($data['type'] === 'consommation') {
        $data['source'] = null;
        $data['puissance_kwc'] = null;
    }

    $compteur = $request->user()->compteurs()->create($data);

    // Génère 30 jours de relevés simulés pour ce nouveau compteur
    Artisan::call('energie:simuler', ['--jours' => 30, '--compteur' => $compteur->id]);

    return response()->json($compteur, 201);
}
    // Historique agrégé : ?debut=2026-09-01&fin=2026-09-30&pas=jour|heure
    public function releves(Request $request, Compteur $compteur)
    {
        abort_unless($compteur->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'debut' => 'nullable|date',
            'fin' => 'nullable|date|after_or_equal:debut',
            'pas' => 'nullable|in:heure,jour',
        ]);

        $fin = isset($data['fin']) ? Carbon::parse($data['fin'])->endOfDay() : now();
        $debut = isset($data['debut'])
            ? Carbon::parse($data['debut'])->startOfDay()
            : $fin->copy()->subDays(7)->startOfDay();
        $pas = $data['pas'] ?? 'jour';

        $format = $pas === 'heure' ? '%Y-%m-%d %H:00:00' : '%Y-%m-%d';

        $lignes = $compteur->releves()
            ->whereBetween('releve_le', [$debut, $fin])
            ->selectRaw("DATE_FORMAT(releve_le, '{$format}') as periode, ROUND(SUM(energie_kwh), 3) as energie_kwh")
            ->groupBy('periode')
            ->orderBy('periode')
            ->get();

        return [
            'compteur' => $compteur,
            'pas' => $pas,
            'total_kwh' => round($lignes->sum('energie_kwh'), 3),
            'releves' => $lignes,
        ];
    }

    // Recharge SIMULÉE de kWh : ajoute de la production au relevé de l'heure en cours
    public function recharger(Request $request, Compteur $compteur, EnergieService $energie)
    {
        abort_unless($compteur->user_id === $request->user()->id, 403);

        if ($compteur->type !== 'production' || !$compteur->actif) {
            return response()->json([
                'message' => 'Seul un compteur de production actif peut être rechargé.',
            ], 422);
        }

        $data = $request->validate([
            'kwh' => ['required', 'numeric', 'gt:0', 'max:1000'],
        ]);

        $heure = now()->startOfHour();

        $releve = DB::transaction(function () use ($compteur, $heure, $data) {
            $releve = Releve::where('compteur_id', $compteur->id)
                ->where('releve_le', $heure)
                ->lockForUpdate()
                ->first();

            if ($releve) {
                $releve->update([
                    'energie_kwh' => $releve->energie_kwh + (float) $data['kwh'],
                ]);
                return $releve;
            }

            return Releve::create([
                'compteur_id' => $compteur->id,
                'releve_le'   => $heure,
                'energie_kwh' => (float) $data['kwh'],
            ]);
        });

        return response()->json([
            'message' => number_format((float) $data['kwh'], 2, ',', ' ')
                . " kWh ajoutés à « {$compteur->nom} ».",
            'releve'  => $releve,
            'bilan'   => $energie->bilan($request->user(), 30),
        ], 201);
    }

    public function destroy(Request $request, Compteur $compteur)
    {
    abort_unless($compteur->user_id === $request->user()->id, 403);

    $nom = $compteur->nom;
    $compteur->delete();   // ses relevés sont supprimés en cascade

    return response()->json(['message' => "Compteur « {$nom} » supprimé."]);
    }
}