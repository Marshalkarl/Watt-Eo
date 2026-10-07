<?php

return [
    // Prix de référence du kWh sur le réseau (en crédits), pour calculer les économies.
    // Valeur d'exemple : à remplacer par le tarif réel que tu citeras dans ton mémoire.
    'tarif_reseau_kwh' => 150,

    'prix_min_ratio' => 0.5,   // minimum = 50 % du tarif réseau
    'prix_max_ratio' => 1.0,   // maximum = 100 % du tarif réseau

    // Facteur d'émission du réseau en kg de CO2 par kWh.
    // Valeur d'exemple : à remplacer par une source officielle et à citer.
    'facteur_co2_kg_kwh' => 0.4,

    'prix_plancher_kwh' => 20,

    'commission_pct' => 5,   // % prélevé sur chaque vente (hypothèse de démonstration)
    'sources' => ['solaire', 'eolien', 'hydraulique', 'biomasse'],

        // Recharge simulée : plafonds de sécurité
    'recharge_max'      => 10000,   // par recharge
    'recharge_max_jour' => 50000,   // par utilisateur et par jour
];