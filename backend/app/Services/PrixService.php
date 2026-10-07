<?php

namespace App\Services;

use App\Models\Offre;

class PrixService
{
    public function reference(): array
    {
        $tarif = (float) config('energie.tarif_reseau_kwh');
        $min = round($tarif * config('energie.prix_min_ratio', 0.5), 2);
        $max = round($tarif * config('energie.prix_max_ratio', 1.0), 2);

        $moyenne = Offre::where('disponible', true)
            ->where('quantite_kwh', '>', 0)
            ->avg('prix_kwh');

        return [
            'tarif_reseau_kwh'      => $tarif,
            'prix_min_kwh'          => $min,
            'prix_max_kwh'          => $max,
            'prix_moyen_marche_kwh' => $moyenne ? round($moyenne, 2) : null,
            'prix_suggere_kwh'      => round($moyenne ?: ($min + $max) / 2, 2),
        ];
    }
}