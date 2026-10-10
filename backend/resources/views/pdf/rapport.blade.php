<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #1f2d24; }
        h1 { color: #21834d; font-size: 22px; margin: 0 0 2px; }
        .sous-titre { color: #718078; margin-bottom: 18px; }
        .cartes { width: 100%; border-collapse: separate; border-spacing: 8px; margin: 0 -8px 10px; }
        .carte { border: 1px solid #e2ebe4; background: #f6faf7; padding: 10px; width: 25%; }
        .carte small { color: #718078; display: block; margin-bottom: 4px; }
        .carte strong { font-size: 15px; }
        h2 { font-size: 14px; color: #21834d; margin: 18px 0 6px; }
        table.liste { width: 100%; border-collapse: collapse; }
        table.liste th { background: #21834d; color: #fff; text-align: left; padding: 6px; font-size: 11px; }
        table.liste td { border-bottom: 1px solid #e8efe9; padding: 6px; }
        .droite { text-align: right; }
        .pied { margin-top: 24px; color: #718078; font-size: 10px; }
    </style>
</head>
<body>
    @php
        $f = fn ($v, $d = 2) => number_format((float) $v, $d, ',', ' ');
    @endphp

    <h1>Watt-Éo : rapport mensuel</h1>
    <div class="sous-titre">
        {{ ucfirst($moisLibelle) }} · Producteur : {{ $producteur->name }}
    </div>

    <table class="cartes">
        <tr>
            <td class="carte"><small>Ventes confirmées</small><strong>{{ $nombre }}</strong></td>
            <td class="carte"><small>Énergie vendue</small><strong>{{ $f($kwh, 3) }} kWh</strong></td>
            <td class="carte"><small>Chiffre d'affaires</small><strong>{{ $f($brut) }}</strong></td>
            <td class="carte"><small>Revenus nets</small><strong>{{ $f($net) }}</strong></td>
        </tr>
        <tr>
            <td class="carte"><small>Commissions Watt-Éo</small><strong>{{ $f($commission) }}</strong></td>
            <td class="carte"><small>Prix moyen</small><strong>{{ $f($prixMoyen) }} / kWh</strong></td>
            <td class="carte"><small>Commandes annulées ou refusées</small><strong>{{ $annulees }}</strong></td>
            <td class="carte"><small>Commandes en attente</small><strong>{{ $enAttente }}</strong></td>
        </tr>
    </table>
    <div style="color:#718078">Montants en crédits.</div>

    <h2>Détail des ventes confirmées</h2>

    @if ($ventes->isEmpty())
        <p>Aucune vente confirmée sur cette période.</p>
    @else
        <table class="liste">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Acheteur</th>
                    <th class="droite">Quantité (kWh)</th>
                    <th class="droite">Total</th>
                    <th class="droite">Commission</th>
                    <th class="droite">Net</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($ventes as $v)
                    <tr>
                        <td>{{ $v->created_at->format('d/m/Y H:i') }}</td>
                        <td>{{ $v->consommateur?->name ?? '—' }}</td>
                        <td class="droite">{{ $f($v->quantite_kwh, 3) }}</td>
                        <td class="droite">{{ $f($v->prix_total) }}</td>
                        <td class="droite">{{ $f($v->commission ?? 0) }}</td>
                        <td class="droite">{{ $f($v->montant_net ?? $v->prix_total) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    <div class="pied">Document généré le {{ now()->format('d/m/Y à H:i') }} · Plateforme Watt-Éo (simulation)</div>
</body>
</html>