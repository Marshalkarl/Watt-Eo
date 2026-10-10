<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'non_lues'      => $user->unreadNotifications()->count(),
            'notifications' => $user->notifications()->latest()->limit(30)->get()->map(fn ($n) => [
                'id'             => $n->id,
                'type'           => $n->data['type'] ?? null,
                'titre'          => $n->data['titre'] ?? '',
                'message'        => $n->data['message'] ?? '',
                'transaction_id' => $n->data['transaction_id'] ?? null,
                'lue'            => $n->read_at !== null,
                'date'           => $n->created_at,
            ]),
        ]);
    }

    public function lire(Request $request, string $id): JsonResponse
    {
        // Seules les notifications de l'utilisateur connecté sont accessibles (sinon 404)
        $request->user()->notifications()->whereKey($id)->firstOrFail()->markAsRead();

        return response()->json(['ok' => true]);
    }

    public function toutLire(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json(['ok' => true]);
    }
}