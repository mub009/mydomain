<?php

return [
    'access_secret' => env('JWT_ACCESS_SECRET'),
    'refresh_secret' => env('JWT_REFRESH_SECRET'),
    'access_ttl' => env('JWT_ACCESS_TTL', '15m'),
    'refresh_ttl' => env('JWT_REFRESH_TTL', '30d'),
];
