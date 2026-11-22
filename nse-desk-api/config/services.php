<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],


    /*
     * Zerodha Kite Connect apps. Slot 1 is KITE_API_KEY / KITE_API_SECRET;
     * add _2 … _5 only for accounts Zerodha won't allow on the first app.
     */
    'kite' => [
        'apps' => collect(range(1, 5))->mapWithKeys(fn ($n) => [$n => [
            'key' => env($n === 1 ? 'KITE_API_KEY' : "KITE_API_KEY_{$n}"),
            'secret' => env($n === 1 ? 'KITE_API_SECRET' : "KITE_API_SECRET_{$n}"),
        ]])->all(),
        'api_root' => env('KITE_API_ROOT', 'https://api.kite.trade'),
        'login_root' => env('KITE_LOGIN_ROOT', 'https://kite.zerodha.com'),
    ],

    /* The NSE Agent Desk web app; Zerodha logins return there. */
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),

];
