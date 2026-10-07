@php
    $logoPath = public_path('images/Watt-Eo-logo.png');
    $logo = file_exists($logoPath)
        ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath))
        : null;

    $sources = [
        'solaire' => 'Solaire',
        'eolien' => 'Éolien',
        'hydraulique' => 'Hydraulique',
        'biomasse' => 'Biomasse',
    ];
    $source = $sources[$transaction->offre?->source] ?? 'Non renseignée';

    $total      = (float) $transaction->prix_total;
    $commission = (float) ($transaction->commission ?? 0);
    $net        = (float) ($transaction->montant_net ?? $transaction->prix_total);
    $prixKwh    = $transaction->quantite_kwh > 0 ? $total / $transaction->quantite_kwh : 0;

    $fmt = fn ($n) => number_format($n, 2, ',', ' ');
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Reçu #{{ $transaction->id }}</title>
    <style>
        @page { margin: 35px 40px; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #1f2937; }

        .top { width: 100%; border-collapse: collapse; }
        .top td { border: none; padding: 0; vertical-align: middle; }
        .logo img { height: 55px; }
        .logo-text { font-size: 26px; font-weight: bold; color: #12263f; }
        .logo-text span { color: #f5a800; }
        .doc-title { text-align: right; }
        .doc-title h1 { margin: 0; font-size: 24px; letter-spacing: 2px; color: #12263f; }
        .doc-title p { margin: 4px 0 0; color: #6b7280; }

        .accent { height: 4px; background: #f5a800; margin: 18px 0 25px; }

        .amount-box { background: #12263f; color: #ffffff; text-align: center; padding: 20px; border-radius: 6px; }
        .amount-box .label { font-size: 11px; letter-spacing: 2px; color: #f5a800; }
        .amount-box .value { font-size: 30px; font-weight: bold; margin-top: 6px; }

        .badge { display: inline-block; background: #16a34a; color: #fff; padding: 3px 12px; border-radius: 10px; font-size: 11px; }

        table.details { width: 100%; border-collapse: collapse; margin-top: 25px; }
        table.details th, table.details td { padding: 11px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        table.details th { width: 35%; color: #6b7280; font-weight: normal; background: #f9fafb; }
        table.details td { font-weight: bold; }

        .thanks { margin-top: 35px; text-align: center; color: #12263f; font-size: 13px; }

        .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center;
                  font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    </style>
</head>
<body>

    <table class="top">
        <tr>
            <td class="logo">
                @if($logo)
                    <img src="{{ $logo }}" alt="Watt-Eo">
                @else
                    <div class="logo-text">Watt<span>-Eo</span></div>
                @endif
            </td>
            <td class="doc-title">
                <h1>REÇU</h1>
                <p>N° {{ str_pad($transaction->id, 6, '0', STR_PAD_LEFT) }}</p>
            </td>
        </tr>
    </table>

    <div class="accent"></div>

    <div class="amount-box">
        <div class="label">{{ $estProducteur ? 'MONTANT NET REÇU' : 'MONTANT PAYÉ' }}</div>
        <div class="value">{{ $fmt($estProducteur ? $net : $total) }} crédits</div>
    </div>

    <table class="details">
        <tr>
            <th>Référence</th>
            <td>#{{ $transaction->id }}</td>
        </tr>
        <tr>
            <th>Commande passée le</th>
            <td>{{ $transaction->created_at->format('d/m/Y à H:i') }}</td>
        </tr>
        <tr>
            <th>Confirmée le</th>
            <td>{{ $transaction->updated_at->format('d/m/Y à H:i') }}</td>
        </tr>
        <tr>
            <th>Producteur</th>
            <td>{{ $transaction->offre?->producteur?->name ?? 'Non renseigné' }}</td>
        </tr>
        <tr>
            <th>Acheteur</th>
            <td>{{ $transaction->consommateur?->name ?? 'Non renseigné' }}</td>
        </tr>
        <tr>
            <th>Source d’énergie</th>
            <td>{{ $source }}</td>
        </tr>
        <tr>
            <th>Quantité</th>
            <td>{{ rtrim(rtrim(number_format($transaction->quantite_kwh, 3, ',', ' '), '0'), ',') }} kWh</td>
        </tr>
        <tr>
            <th>Prix par kWh</th>
            <td>{{ $fmt($prixKwh) }} crédits</td>
        </tr>
        <tr>
            <th>Total payé par l’acheteur</th>
            <td>{{ $fmt($total) }} crédits</td>
        </tr>
        @if($estProducteur)
            <tr>
                <th>Commission Watt-Eo</th>
                <td>− {{ $fmt($commission) }} crédits</td>
            </tr>
            <tr>
                <th>Montant net crédité</th>
                <td>{{ $fmt($net) }} crédits</td>
            </tr>
        @endif
        <tr>
            <th>Statut</th>
            <td><span class="badge">Confirmée</span></td>
        </tr>
    </table>

    <div class="thanks">Merci pour votre confiance.</div>

    <div class="footer">
        Watt-Eo &bull; Reçu généré le {{ now()->format('d/m/Y à H:i') }}
    </div>

</body>
</html>