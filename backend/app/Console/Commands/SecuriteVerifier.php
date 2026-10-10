<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

class SecuriteVerifier extends Command
{
    protected $signature = 'securite:verifier';
    protected $description = 'Contrôle la configuration de sécurité de Watt-Éo';

    private array $lignes = [];
    private bool $echec = false;

    private function controle(string $nom, bool $ok, string $detail, bool $critique = true): void
    {
        if (! $ok && $critique) {
            $this->echec = true;
        }
        $this->lignes[] = [$ok ? 'OK' : ($critique ? 'ÉCHEC' : 'ALERTE'), $nom, $detail];
    }

    public function handle(): int
    {
        $prod = app()->environment('production');

        $this->controle('APP_KEY', ! empty(config('app.key')), 'clé de chiffrement définie');
        $this->controle('APP_DEBUG', ! config('app.debug'), config('app.debug') ? 'debug actif' : 'désactivé', $prod);
        $this->controle('APP_URL en HTTPS', str_starts_with((string) config('app.url'), 'https://'), (string) config('app.url'), $prod);

        $exp = config('sanctum.expiration');
        $this->controle('Expiration des tokens', $exp !== null && $exp <= 1440, $exp ? "$exp min" : 'aucune');

        $origines = config('cors.allowed_origins', []);
        $this->controle('CORS sans joker', ! in_array('*', $origines, true), implode(', ', $origines));

        foreach (['login', 'register', 'api', 'achat', 'transaction', 'recharge', 'ecriture'] as $nom) {
            $this->controle("Limiteur « $nom »", RateLimiter::limiter($nom) !== null, 'déclaré');
        }

        $this->controle('Journal d\'audit', Schema::hasTable('audit_logs'), 'table audit_logs');

        // Routes /api/admin protégées par le middleware admin
        $sansAdmin = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($r) => str_starts_with($r->uri(), 'api/admin'))
            ->reject(fn ($r) => in_array('admin', $r->gatherMiddleware(), true)
                || in_array(\App\Http\Middleware\EnsureAdmin::class, $r->gatherMiddleware(), true))
            ->map(fn ($r) => $r->uri());
        $this->controle('Routes admin protégées', $sansAdmin->isEmpty(), $sansAdmin->isEmpty() ? 'toutes' : $sansAdmin->implode(', '));

        // Mot de passe du compte admin de démonstration
        $admin = User::where('email', 'admin@watt-eo.test')->first();
        if ($admin) {
            $faible = collect(['password', 'admin', 'admin123', 'Admin123', 'password123'])
                ->contains(fn ($mdp) => Hash::check($mdp, $admin->password));
            $this->controle('Mot de passe admin', ! $faible, $faible ? 'valeur par défaut détectée' : 'non trivial', $prod);
        }

        $this->table(['Statut', 'Contrôle', 'Détail'], $this->lignes);

        // Information : routes publiques (à relire à la main)
        $publiques = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($r) => str_starts_with($r->uri(), 'api/'))
            ->reject(fn ($r) => collect($r->gatherMiddleware())->contains(fn ($m) => str_contains($m, 'auth')))
            ->map(fn ($r) => implode('|', $r->methods()) . ' ' . $r->uri());
        $this->newLine();
        $this->info('Routes publiques (sans auth), à relire :');
        $publiques->each(fn ($l) => $this->line("  $l"));

        return $this->echec ? self::FAILURE : self::SUCCESS;
    }
}