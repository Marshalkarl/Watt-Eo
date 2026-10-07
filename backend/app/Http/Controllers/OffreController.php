<?php

namespace App\Http\Controllers;

use App\Models\Offre;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\EnergieService;
use Illuminate\Validation\ValidationException;
use App\Models\AuditLog;

class OffreController extends Controller
{
    /**
     * Liste des offres disponibles (publique, pour la carte).
     * Filtre optionnel par proximité : ?latitude=..&longitude=..&rayon=10 (km)
     */
    public function index(Request $request): JsonResponse
{
    $data = $request->validate([
        'latitude'     => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude,rayon'],
        'longitude'    => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude,rayon'],
        'rayon'        => ['nullable', 'numeric', 'min:0.1', 'max:500'],
        'prix_max'     => ['nullable', 'numeric', 'min:0'],
        'quantite_min' => ['nullable', 'numeric', 'min:0'],
        'source'       => ['nullable', 'in:' . implode(',', config('energie.sources'))],
        'tri'          => ['nullable', 'in:recent,prix_asc,prix_desc,quantite_desc,distance'],
    ]);

       $query = Offre::with('producteur:id,name')
        ->where('disponible', true)
        ->where('quantite_kwh', '>', 0)
        ->whereHas('producteur', fn ($q) => $q->where('actif', true));

    if (isset($data['prix_max'])) {
        $query->where('prix_kwh', '<=', (float) $data['prix_max']);
    }

    if (isset($data['quantite_min'])) {
        $query->where('quantite_kwh', '>=', (float) $data['quantite_min']);
    }

    if (!empty($data['source'])) {                      
        $query->where('source', $data['source']);
    }

    $aPosition = isset($data['latitude'], $data['longitude']);

    if ($aPosition) {
        $lat = (float) $data['latitude'];
        $lng = (float) $data['longitude'];

        // Formule de Haversine (distance en km)
        $distance = '(6371 * acos(least(1, greatest(-1,
            cos(radians(?)) * cos(radians(latitude))
            * cos(radians(longitude) - radians(?))
            + sin(radians(?)) * sin(radians(latitude))
        ))))';

        $query->select('offres.*')
            ->selectRaw("$distance as distance_km", [$lat, $lng, $lat])
            ->whereNotNull('latitude')
            ->whereNotNull('longitude');

        if (isset($data['rayon'])) {
            $query->havingRaw('distance_km <= ?', [(float) $data['rayon']]);
        }
    }

    // Tri : par défaut, les plus proches si on a une position, sinon les plus récentes.
    $ordre = $data['tri'] ?? ($aPosition ? 'distance' : 'recent');
    if ($ordre === 'distance' && !$aPosition) {
        $ordre = 'recent';
    }

    match ($ordre) {
        'prix_asc'      => $query->orderBy('prix_kwh'),
        'prix_desc'     => $query->orderByDesc('prix_kwh'),
        'quantite_desc' => $query->orderByDesc('quantite_kwh'),
        'distance'      => $query->orderBy('distance_km'),
        default         => $query->latest(),
    };

    return response()->json($query->get());
}
    /**
     * Détail d'une offre (publique).
     */
    public function show(Offre $offre): JsonResponse
    {
        return response()->json($offre->load('producteur:id,name'));
    }

    /**
     * Offres du producteur connecté.
     */
    public function mesOffres(Request $request): JsonResponse
    {
        return response()->json(
            $request->user()->offres()->latest()->get()
        );
    }

    /**
     * Création d'une offre (producteurs uniquement).
     */
    public function store(Request $request, EnergieService $energie): JsonResponse
    {
    $user = $request->user();

    if ($request->user()->role !== 'producteur') {
    return response()->json(
        ['message' => 'Seuls les producteurs peuvent publier des offres.'],
        403
    );
    }

    if ($user->role !== 'producteur') {
        return response()->json(
            ['message' => 'Seuls les producteurs peuvent publier des offres.'],
            403
        );
    }

    $plancher = (float) config('energie.prix_plancher_kwh');
    $plafond  = (float) config('energie.tarif_reseau_kwh');

    $data = $request->validate([
        'quantite_kwh' => ['required', 'numeric', 'gt:0', 'max:100000', 'decimal:0,3'],
        'prix_kwh'     => ['required', 'numeric', "between:$plancher,$plafond"],
        'latitude'     => ['required', 'numeric', 'between:-90,90'],
        'longitude'    => ['required', 'numeric', 'between:-180,180'],
        'source'       => ['required', 'in:' . implode(',', config('energie.sources'))],
    ], [
        'prix_kwh.between' => "Le prix doit être compris entre $plancher et $plafond crédits par kWh.",
    ]);

    // Un producteur qui a déclaré un compteur de production ne peut pas
    // vendre plus que son surplus réel (30 derniers jours).
    if ($energie->aCompteurProduction($user)) {
        $surplus = $energie->bilan($user, 30)['surplus_kwh'];

        if ((float) $data['quantite_kwh'] > $surplus) {
            throw ValidationException::withMessages([
                'quantite_kwh' => "Quantité trop élevée : vous n'avez que "
                    . number_format($surplus, 2, ',', ' ')
                    . " kWh disponibles à la vente.",
            ]);
        }
    }

    $offre = $user->offres()->create($data + ['disponible' => true]);

    AuditLog::enregistrer($user, 'offre_creee', $offre, [
        'quantite_kwh' => $data['quantite_kwh'],
        'prix_kwh'     => $data['prix_kwh'],
        'source'       => $data['source'],
    ]);

    return response()->json($offre->refresh(), 201);
}

/**
 * Modification d'une offre (son propriétaire uniquement).
 */
public function update(Request $request, Offre $offre): JsonResponse
{
    if ($offre->producteur_id !== $request->user()->id) {
        return response()->json(['message' => 'Action non autorisée.'], 403);
    }

    if ($offre->retiree) {
        return response()->json(['message' => 'Cette offre a été retirée par un administrateur.'], 403);
    }

    $plancher = (float) config('energie.prix_plancher_kwh');
    $plafond  = (float) config('energie.tarif_reseau_kwh');

    $data = $request->validate([
        'quantite_kwh' => ['sometimes', 'numeric', 'gt:0', 'max:100000', 'decimal:0,3'],
        'prix_kwh'     => ['sometimes', 'numeric', "between:$plancher,$plafond"],
        'latitude'     => ['sometimes', 'numeric', 'between:-90,90'],
        'longitude'    => ['sometimes', 'numeric', 'between:-180,180'],
        'disponible'   => ['sometimes', 'boolean'],
    ], [
        'prix_kwh.between' => "Le prix doit être compris entre $plancher et $plafond crédits par kWh.",
    ]);

    $offre->update($data);

    AuditLog::enregistrer($request->user(), 'offre_modifiee', $offre, $data);

    return response()->json($offre->refresh());
}
    /**
     * Suppression d'une offre (son propriétaire uniquement).
     */
    public function destroy(Request $request, Offre $offre): JsonResponse
    {
        if ($offre->producteur_id !== $request->user()->id) {
            return response()->json(['message' => 'Action non autorisée.'], 403);
        }

        AuditLog::enregistrer($request->user(), 'offre_supprimee', $offre);
        
        $offre->delete();

        return response()->json(['message' => 'Offre supprimée.']);
    }
}