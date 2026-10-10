<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
    $middleware->trustProxies(at: '*');

    $middleware->alias([
        'admin' => \App\Http\Middleware\EnsureAdmin::class,
        'actif' => \App\Http\Middleware\EnsureAccountActive::class,
    ]);
    
        // En-têtes de sécurité sur toutes les réponses de l'API
        $middleware->api(append: [\App\Http\Middleware\SecurityHeaders::class]);

        // API pure : pas de page de connexion vers laquelle rediriger
        $middleware->redirectGuestsTo(fn () => null);

        // Limite générale appliquée à toutes les routes de l'API
        $middleware->throttleApi('api');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Toute requête /api/* reçoit du JSON, jamais une page HTML
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request, \Throwable $e) => $request->is('api/*') || $request->expectsJson()
        );

        // 404 : message neutre, sans détail interne
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Ressource introuvable.'], 404);
            }
        });

        // 429 : trop de requêtes (limiteurs login, achat, recharge...)
        $exceptions->render(function (TooManyRequestsHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(
                    ['message' => 'Trop de requêtes, réessayez dans quelques instants.'],
                    429,
                    $e->getHeaders()
                );
            }
        });
    })->create();