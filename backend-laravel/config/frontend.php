<?php

return [
    // Where the React SPA is served from — used to build links back to it
    // (a business's own page, the QR-claim screen) from server-side code.
    'origin' => env('CLIENT_ORIGIN', 'https://mydomainbook.com'),
];
