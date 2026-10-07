<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@watt-eo.test'],
            [
                'name'     => 'Administrateur Watt-Eo',
                'password' => 'Admin12345',   // démo uniquement
                'role'     => 'admin',
                'credits'  => 0,
            ],
        );
    }
}