<?php

// Where each business's own website is served. With SITE_DOMAIN set (for
// example "mydomainbook.com"), a business's site lives on its own subdomain,
// https://<slug>.mydomainbook.com, as well as at /site/<slug>. Left empty
// (local development), sites are only at /site/<slug>.
// The DNS, web server and certificate need a wildcard for this — see README
// "Business websites on subdomains"; `php artisan sites:check` diagnoses it.

// Forgiving about how the domain is written: "https://www.mydomainbook.com/",
// "*.mydomainbook.com" and "mydomainbook.com" all mean mydomainbook.com.
$domain = strtolower(trim((string) env('SITE_DOMAIN', '')));
$domain = preg_replace('#^[a-z]+://#', '', $domain);
$domain = preg_replace('#[/?\#].*$#', '', $domain);
$domain = preg_replace('#:\d+$#', '', $domain);
$domain = preg_replace('#^(\*\.|\.|www\.)+#', '', $domain);

return [
    'domain' => $domain !== '' ? $domain : null,

    'scheme' => env('SITE_SCHEME', 'https'),

    // Only needed when the sites are served on a non-standard port, e.g.
    // "8000" while trying subdomains locally on <slug>.localhost.
    'port' => env('SITE_PORT') ?: null,

    // Subdomains that are never a business website.
    'reserved' => ['www', 'api', 'admin', 'mail', 'app', 'static', 'cdn'],
];
