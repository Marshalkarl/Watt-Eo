<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Transaction;
use App\Models\User;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class ProfilController extends Controller
{
    /**
     * Modification du nom et de l'email. Le changement d'email exige le mot de passe actuel.
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name'  => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
        ], [
            'email.unique' => 'Cette adresse email est déjà utilisée.',
        ]);

        if (strtolower($data['email']) !== strtolower($user->email)) {
            $request->validate(['password' => ['required', 'string']], [
                'password.required' => 'Entrez votre mot de passe pour changer d\'adresse email.',
            ]);

            if (!Hash::check($request->input('password'), $user->password)) {
                throw ValidationException::withMessages(['password' => ['Mot de passe incorrect.']]);
            }
        }

        $user->fill($data);
        $champs = array_keys($user->getDirty());
        $user->save();

        if ($champs) {
            // On journalise les champs modifiés, jamais les valeurs
            AuditLog::enregistrer($user, 'profil_modifie', $user, ['champs' => $champs]);
        }

        return response()->json($user);
    }

    /**
     * Changement de mot de passe : les autres sessions sont fermées, la session courante reste ouverte.
     */
    public function changerMotDePasse(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'current_password' => ['required', 'string'],
            'password'         => [
                'required', 'string', 'confirmed', 'different:current_password',
                Password::min(8)->letters()->numbers(),
            ],
        ], [
            'password.min'       => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.letters'   => 'Le mot de passe doit contenir au moins une lettre.',
            'password.numbers'   => 'Le mot de passe doit contenir au moins un chiffre.',
            'password.confirmed' => 'La confirmation du mot de passe ne correspond pas.',
            'password.different' => 'Le nouveau mot de passe doit être différent de l\'ancien.',
        ]);

        if (!Hash::check($request->input('current_password'), $user->password)) {
            AuditLog::enregistrer($user, 'mot_de_passe_echec');

            throw ValidationException::withMessages([
                'current_password' => ['Le mot de passe actuel est incorrect.'],
            ]);
        }

        $user->password = $request->input('password'); // haché par le cast 'hashed'
        $user->save();

        $user->tokens()
            ->where('id', '!=', $request->user()->currentAccessToken()->id)
            ->delete();

        AuditLog::enregistrer($user, 'mot_de_passe_modifie');

        return response()->json(['message' => 'Mot de passe modifié.']);
    }

    /**
     * Suppression du compte par anonymisation : l'historique des transactions reste cohérent
     * pour l'autre partie, mais plus aucune donnée personnelle n'est conservée.
     */
    public function supprimer(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role === 'admin') {
            return response()->json(['message' => 'Un compte administrateur ne peut pas être supprimé ici.'], 403);
        }

        $request->validate(['password' => ['required', 'string']]);

        if (!Hash::check($request->input('password'), $user->password)) {
            AuditLog::enregistrer($user, 'suppression_compte_echec');

            throw ValidationException::withMessages(['password' => ['Mot de passe incorrect.']]);
        }

        try {
            DB::transaction(function () use ($user) {
                $compte = User::whereKey($user->id)->lockForUpdate()->firstOrFail();

                // Retrait des offres d'abord : un achat simultané ne peut plus passer
                $compte->offres()->where('disponible', true)->update([
                    'disponible'    => false,
                    'retiree'       => true,
                    'motif_retrait' => 'Compte supprimé',
                ]);

                $achatsEnAttente = Transaction::where('consommateur_id', $compte->id)
                    ->where('statut', 'en_attente')->exists();

                $ventesEnAttente = Transaction::whereHas('offre', fn ($q) => $q->where('producteur_id', $compte->id))
                    ->where('statut', 'en_attente')->exists();

                if ($achatsEnAttente || $ventesEnAttente) {
                    // L'exception annule aussi le retrait des offres
                    throw new DomainException(
                        'Vous avez des commandes en attente : confirmez, refusez ou annulez-les avant de supprimer votre compte.'
                    );
                }

                AuditLog::enregistrer($compte, 'compte_supprime', $compte, ['role' => $compte->role]);

                $compte->notifications()->delete();
                $compte->tokens()->delete();

                $compte->forceFill([
                    'name'      => 'Compte supprimé',
                    'email'     => "supprime-{$compte->id}-" . Str::lower(Str::random(8)) . '@watt-eo.invalid',
                    'password'  => Str::random(40),
                    'actif'     => false,
                    'latitude'  => null,
                    'longitude' => null,
                ])->save();
            });
        } catch (DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['message' => 'Votre compte a été supprimé.']);
    }
}