<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    // Journal en ajout seul : pas de updated_at
    public $timestamps = false;

    protected $fillable = [
        'user_id', 'action', 'cible_type', 'cible_id', 'details', 'ip', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'details'    => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Enregistre une action. Une panne du journal ne doit jamais bloquer l'action elle-même.
     */
    public static function enregistrer(?User $user, string $action, ?Model $cible = null, array $details = []): void
    {
        try {
            static::create([
                'user_id'    => $user?->id,
                'action'     => $action,
                'cible_type' => $cible ? class_basename($cible) : null,
                'cible_id'   => $cible?->getKey(),
                'details'    => $details ?: null,
                'ip'         => request()->ip(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}