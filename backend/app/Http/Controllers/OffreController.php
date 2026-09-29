<?php

namespace App\Http\Controllers;

use App\Models\Offre;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OffreController extends Controller
{
    /**
     * Liste des offres disponibles (publique, pour la carte).
     * Filtre optionnel par proximité : ?latitude=..&longitude=..&rayon=10 (km)
     */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'latitude'  => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude,rayon'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude,rayon'],
            'rayon'     => ['nullable', 'numeric', 'min:0.1', 'max:500'],
        ]);

        $query = Offre::with('producteur:id,name')
            ->where('disponible', true)
            ->where('quantite_kwh', '>', 0);

        if (isset($data['latitude'], $data['longitude'])) {
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
                ->whereNotNull('longitude')
                ->orderBy('distance_km');

            if (isset($data['rayon'])) {
                $query->havingRaw('distance_km <= ?', [(float) $data['rayon']]);
            }
        } else {
            $query->latest();
        }

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
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role !== 'producteur') {
            return response()->json(
                ['message' => 'Seuls les producteurs peuvent publier des offres.'],
                403
            );
        }

        $data = $request->validate([
            'quantite_kwh' => ['required', 'numeric', 'gt:0'],
            'prix_kwh'     => ['required', 'numeric', 'gt:0'],
            'latitude'     => ['required', 'numeric', 'between:-90,90'],
            'longitude'    => ['required', 'numeric', 'between:-180,180'],
        ]);

        $offre = $user->offres()->create($data + ['disponible' => true]);

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

        $data = $request->validate([
            'quantite_kwh' => ['sometimes', 'numeric', 'gt:0'],
            'prix_kwh'     => ['sometimes', 'numeric', 'gt:0'],
            'latitude'     => ['sometimes', 'numeric', 'between:-90,90'],
            'longitude'    => ['sometimes', 'numeric', 'between:-180,180'],
            'disponible'   => ['sometimes', 'boolean'],
        ]);

        $offre->update($data);

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

        $offre->delete();

        return response()->json(['message' => 'Offre supprimée.']);
    }
}