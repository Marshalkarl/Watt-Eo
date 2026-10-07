<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && !$user->actif) {
            $user->tokens()->delete();

            return response()->json(['message' => 'Ce compte est suspendu.'], 403);
        }

        return $next($request);
    }
}