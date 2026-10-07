<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'latitude',
        'longitude',
        'credits',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
            'latitude'          => 'float',
            'longitude'         => 'float',
            'credits'           => 'float',
            'actif'             => 'boolean',
        ];
    }

    public function offres(): HasMany
    {
        return $this->hasMany(Offre::class, 'producteur_id');
    }

    public function achats(): HasMany
    {
        return $this->hasMany(Transaction::class, 'consommateur_id');
    }

    public function mouvementsCredits(): HasMany
    {
        return $this->hasMany(MouvementCredit::class);
    }

    public function compteurs()
    {
        return $this->hasMany(Compteur::class);
    }

    public function estAdmin(): bool
    {
        return $this->role === 'admin';
    }
}