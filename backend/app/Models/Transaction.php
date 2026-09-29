<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transaction extends Model
{
    protected $fillable = [
        'offre_id',
        'consommateur_id',
        'quantite_kwh',
        'prix_total',
        'statut',
    ];

    protected $casts = [
        'quantite_kwh' => 'float',
        'prix_total'   => 'float',
    ];

    public function offre(): BelongsTo
    {
        return $this->belongsTo(Offre::class);
    }

    public function consommateur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consommateur_id');
    }
}