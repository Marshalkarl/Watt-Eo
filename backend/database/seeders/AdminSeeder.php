<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('ADMIN_EMAIL');
        $password = env('ADMIN_PASSWORD');

        if (!$email || !$password) {
            return;
        }

        User::firstOrCreate(
            ['email' => $email],
            [
                'name'     => 'Administrateur Watt-Eo',
                'password' => Hash::make($password),
                'role'     => 'admin',
                'credits'  => 0,
            ]
        );
    }
}