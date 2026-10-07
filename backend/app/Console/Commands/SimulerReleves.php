<?php

namespace App\Console\Commands;

use App\Models\Compteur;
use App\Models\Releve;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SimulerReleves extends Command
{
    protected $signature = 'energie:simuler {--jours=30 : Nombre de jours à générer} {--compteur= : ID d\'un compteur précis}';
    protected $description = 'Génère des relevés horaires simulés (production solaire / consommation)';

    public function handle(): int
    {
        $jours = (int) $this->option('jours');

        $query = Compteur::where('actif', true);
        if ($this->option('compteur')) {
            $query->where('id', $this->option('compteur'));
        }
        $compteurs = $query->get();

        if ($compteurs->isEmpty()) {
            $this->warn('Aucun compteur actif.');
            return self::FAILURE;
        }

        $fin = Carbon::now()->startOfHour();
        $debut = $fin->copy()->subDays($jours)->startOfDay();

        foreach ($compteurs as $compteur) {
            $rows = [];
            $maintenant = now();

            for ($jour = $debut->copy(); $jour->lt($fin); $jour->addDay()) {
                $meteo = mt_rand(40, 100) / 100; // facteur météo du jour

                for ($h = 0; $h < 24; $h++) {
                    $t = $jour->copy()->setHour($h);
                    if ($t->gte($fin)) {
                        break;
                    }

                    $kwh = $compteur->type === 'production'
                        ? $this->production($compteur, $h, $meteo)
                        : $this->consommation($h);

                    $rows[] = [
                        'compteur_id' => $compteur->id,
                        'releve_le' => $t->toDateTimeString(),
                        'energie_kwh' => round($kwh, 3),
                        'created_at' => $maintenant,
                        'updated_at' => $maintenant,
                    ];
                }
            }

            foreach (array_chunk($rows, 500) as $lot) {
                Releve::upsert($lot, ['compteur_id', 'releve_le'], ['energie_kwh', 'updated_at']);
            }

            $this->info("Compteur #{$compteur->id} ({$compteur->nom}) : " . count($rows) . ' relevés.');
        }

        return self::SUCCESS;
    }

    // Courbe en cloche entre 6 h et 18 h, pic à midi
    private function production(Compteur $c, int $h, float $meteo): float
    {
        if ($h < 6 || $h > 18) {
            return 0;
        }
        $courbe = sin(M_PI * ($h - 6) / 12);
        $bruit = mt_rand(90, 110) / 100;
        return ($c->puissance_kwc ?? 1) * 0.8 * $courbe * $meteo * $bruit;
    }

    // Charge de base + pics matin (6-8 h) et soir (18-22 h)
    private function consommation(int $h): float
    {
        $base = 0.3;
        if ($h >= 6 && $h <= 8) {
            $base += 0.5;
        }
        if ($h >= 18 && $h <= 22) {
            $base += 1.0;
        }
        return $base * (mt_rand(80, 120) / 100);
    }
}