<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Compteur extends Model
{
    protected $fillable = ['user_id', 'nom', 'type', 'source', 'puissance_kwc', 'actif'];

    protected $casts = [
        'puissance_kwc' => 'float',
        'actif' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function releves()
    {
        return $this->hasMany(Releve::class);
    }
}
