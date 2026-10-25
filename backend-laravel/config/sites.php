<?php

// Where each business's own website is served. With SITE_DOMAIN set (for
// example "mydomainbook.com"), a business's site lives on its own subdomain,
// https://<slug>.mydomainbook.com, and the old /site/<slug> path redirects
// there. Left empty (local development), sites stay at /site/<slug>.
// The DNS, web server and certificate need a wildcard for this — see README
// "Business websites on subdomains".
return [
    'domain' => env('SITE_DOMAIN') ?: null,

    'scheme' => env('SITE_SCHEME', 'https'),

    // Only needed when the sites are served on a non-standard port, e.g.
    // "8000" while trying subdomains locally on <slug>.localhost.
    'port' => env('SITE_PORT') ?: null,

    // Subdomains that are never a business website.
    'reserved' => ['www', 'api', 'admin', 'mail', 'app', 'static', 'cdn'],
];
