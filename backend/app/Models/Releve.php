<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Releve extends Model
{
    protected $fillable = ['compteur_id', 'releve_le', 'energie_kwh'];

    protected $casts = [
        'releve_le' => 'datetime',
        'energie_kwh' => 'float',
    ];

    public function compteur()
    {
        return $this->belongsTo(Compteur::class);
    }
}