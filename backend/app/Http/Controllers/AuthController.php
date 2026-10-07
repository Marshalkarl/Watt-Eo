<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'      => ['required', 'string', 'max:255'],
            'email'     => ['required', 'email', 'max:255', 'unique:users,email'],
            'password'  => [
                'required', 'string', 'confirmed',
                Password::min(8)->letters()->numbers(),
            ],
            'role'      => ['required', Rule::in(['producteur', 'consommateur'])],
            'latitude'  => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ], [
            'password.min'       => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.letters'   => 'Le mot de passe doit contenir au moins une lettre.',
            'password.numbers'   => 'Le mot de passe doit contenir au moins un chiffre.',
            'password.confirmed' => 'La confirmation du mot de passe ne correspond pas.',
        ]);

        $user = User::create($data);

        $token = $user->createToken('auth_token')->plainTextToken;

        AuditLog::enregistrer($user, 'inscription', $user, ['role' => $user->role]);

        return response()->json([
            'user'  => $user,
            'token' => $token,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (!Auth::attempt($credentials)) {
            // On garde l'email saisi, jamais le mot de passe
            AuditLog::enregistrer(null, 'connexion_echec', null, ['email' => $credentials['email']]);

            return response()->json(['message' => 'Identifiants incorrects.'], 401);
        }

        $user = Auth::user();

        if (!$user->actif) {
            AuditLog::enregistrer($user, 'connexion_refusee_suspendu');

            return response()->json(['message' => 'Ce compte est suspendu.'], 403);
        }

        $user->tokens()->delete();
        $token = $user->createToken('auth_token')->plainTextToken;

        AuditLog::enregistrer($user, 'connexion');

        return response()->json([
            'user'  => $user,
            'token' => $token,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }

    public function logout(Request $request): JsonResponse
    {
        AuditLog::enregistrer($request->user(), 'deconnexion');

        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnexion réussie.']);
    }
}