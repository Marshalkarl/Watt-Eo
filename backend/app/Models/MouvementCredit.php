<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MouvementCredit extends Model
{
    protected $table = 'mouvements_credits';
    
    protected $fillable = [
        'user_id', 'transaction_id', 'type', 'montant', 'solde_apres', 'description',
    ];

    protected $casts = [
        'montant'     => 'float',
        'solde_apres' => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    /** Enregistre un mouvement et met à jour le solde de l'utilisateur en une seule opération. */
    public static function enregistrer(User $user, string $type, float $montant, ?string $description = null, ?int $transactionId = null): self
    {
        $user->increment('credits', $montant); // un montant négatif décrémente
        $user->refresh();

        return self::create([
            'user_id'        => $user->id,
            'transaction_id' => $transactionId,
            'type'           => $type,
            'montant'        => $montant,
            'solde_apres'    => $user->credits,
            'description'    => $description,
        ]);
    }
}