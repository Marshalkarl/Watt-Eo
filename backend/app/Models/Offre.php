<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Offre extends Model
{
    protected $fillable = [
        'producteur_id',
        'quantite_kwh',
        'prix_kwh',
        'source',
        'latitude',
        'longitude',
        'disponible',
    ];

    protected $casts = [
        'quantite_kwh' => 'float',
        'prix_kwh'     => 'float',
        'latitude'     => 'float',
        'longitude'    => 'float',
        'disponible'   => 'boolean',
    ];

    public function producteur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'producteur_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }
}