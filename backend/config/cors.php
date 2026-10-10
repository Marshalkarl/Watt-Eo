<?php

return [
    // Uniquement l'API : les routes sont préfixées par /api (api/login, api/me...)
    'paths' => ['api/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // En production : FRONTEND_URLS=https://ton-domaine.com (séparés par des virgules)
   'allowed_origins' => array_values(array_unique(array_filter(array_map(
    'trim',
    array_merge(
        explode(',', env('FRONTEND_URLS', env('FRONTEND_URL', 'http://localhost:3000'))),
        ['https://watt-eo.vercel.app']
    )
)))),

    // IP locales (test sur téléphone) autorisées uniquement en développement
    'allowed_origins_patterns' => env('APP_ENV') === 'local'
        ? [
            '#^http://(localhost|127\.0\.0\.1):3000$#',
            '#^http://(192\.168|10\.\d+)\.\d+\.\d+:3000$#',
        ]
        : [],

    'allowed_headers' => ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],

    'exposed_headers' => ['Retry-After'],

    'max_age' => 600,

    // Token Bearer dans localStorage : pas de cookies, donc pas de credentials
    'supports_credentials' => false,
];