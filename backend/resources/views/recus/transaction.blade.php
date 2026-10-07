<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: sans-serif; font-size: 13px; color: #222; }
        h1 { font-size: 18px; color: #16a34a; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        td { padding: 6px 0; border-bottom: 1px solid #ddd; }
        td:first-child { color: #666; width: 220px; }
        .total { font-size: 16px; font-weight: bold; color: #16a34a; }
    </style>
</head>
<body>
    <h1>⚡ Reçu de transaction #{{ $t->id }}</h1>
    <p>Plateforme de partage d'énergie renouvelable entre particuliers</p>

    <table>
        <tr><td>Date</td><td>{{ $t->updated_at->format('d/m/Y à H:i') }}</td></tr>
        <tr><td>Producteur</td><td>{{ $t->offre->producteur->name }}</td></tr>
        <tr><td>Consommateur</td><td>{{ $t->consommateur->name }}</td></tr>
        <tr><td>Quantité</td><td>{{ $t->quantite_kwh }} kWh</td></tr>
        <tr><td>Prix unitaire</td><td>{{ $t->offre->prix_kwh }} crédits / kWh</td></tr>
        <tr><td>Statut</td><td>Confirmée</td></tr>
        <tr><td class="total">Total payé</td><td class="total">{{ $t->prix_total }} crédits</td></tr>
    </table>

    <p style="margin-top: 30px; color: #888; font-size: 11px;">
        Document généré automatiquement, à titre de justificatif pour la démonstration du projet.
    </p>
</body>
</html>