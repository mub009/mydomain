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

    // Writing listing descriptions (App\Support\AiWriter). AI_PROVIDER is
    // gemini | claude | builtin; left empty, it uses whichever has a key,
    // else the free built-in writer.
    'ai' => [
        'provider' => env('AI_PROVIDER'),
    ],

    // Google Gemini — free key at https://aistudio.google.com/apikey.
    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-3.5-flash-lite'),
        'base_url' => env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com'),
        // A trusted-certificates file for HTTPS, for a PHP that has none
        // configured (e.g. WAMP on Windows: "cURL error 60"). Servers
        // normally leave this empty.
        'ca_bundle' => env('HTTP_CA_BUNDLE'),
    ],

    // Google Search Console + Indexing API, for getting new listings and
    // websites into Google quickly and reporting which ones are in
    // (App\Support\Seo\GoogleSearch; set-up steps in README "SEO and Google").
    'google_search' => [
        // A service account's JSON key: a path to the .json file (relative
        // paths are read from storage/app/private), or the JSON itself.
        // Empty leaves Google switched off — the sitemap still
        // works, but nothing is submitted or checked.
        'credentials' => env('GOOGLE_SEARCH_CREDENTIALS'),
        // The Search Console property the service account was added to as
        // an Owner. "sc-domain:mydomainbook.com" (a Domain property) covers
        // the main site and every business subdomain at once. For several
        // domains, list them comma-separated
        // ("sc-domain:mydomainbook.com,sc-domain:markkito.com"); each page
        // is checked against the property that covers its domain.
        'property' => env('GOOGLE_SEARCH_PROPERTY'),
        // How many pages one `seo:sync` run may submit / inspect — Google's
        // free quotas are 200 Indexing API notices and 2,000 inspections a day.
        'submit_per_run' => (int) env('GOOGLE_SEARCH_SUBMIT_PER_RUN', 20),
        'inspect_per_run' => (int) env('GOOGLE_SEARCH_INSPECT_PER_RUN', 60),
        'ca_bundle' => env('HTTP_CA_BUNDLE'),
    ],

    // Anthropic Claude (paid).
    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'model' => env('ANTHROPIC_MODEL', 'claude-opus-5-5'),
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

];
