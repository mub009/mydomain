<?php

return [
    // Where the site's pages are served from — used to build links back to it
    // (a business's own page, the QR-claim screen) from server-side code.
    'origin' => env('CLIENT_ORIGIN', 'https://mydomainbook.com'),

    // The address printed in every QR board (https://mydomainbook.com/r/q/MK-100001)
    // and used for shared QR links — the same wherever the boards are made.
    'qr_origin' => rtrim(env('QR_ORIGIN', 'https://mydomainbook.com'), '/'),
];
