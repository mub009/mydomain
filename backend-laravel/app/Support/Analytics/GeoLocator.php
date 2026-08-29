<?php

namespace App\Support\Analytics;

use App\Models\IpGeolocation;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * IP -> city/country, backed by the `ip_geolocations` cache table.
 *
 * City/country for a given IP essentially never changes, and the free
 * lookup API (ip-api.com, no key required) is rate-limited, so every IP is
 * looked up once and reused from the cache after that. A lookup that fails
 * or times out is not cached, so the next page view from that IP simply
 * tries again — analytics degrading to "no location" is fine; blocking or
 * erroring the page-view request over it is not.
 */
class GeoLocator
{
    public static function locate(string $ip): array
    {
        $empty = ['city' => null, 'region' => null, 'country' => null, 'latitude' => null, 'longitude' => null];

        // Private/reserved/loopback addresses (localhost, LAN, Docker
        // networks) have no public geolocation, and are what every request
        // looks like in local development — skip the API call entirely.
        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return $empty;
        }

        $cached = IpGeolocation::find($ip);
        if ($cached) {
            return [
                'city' => $cached->city, 'region' => $cached->region, 'country' => $cached->country,
                'latitude' => $cached->latitude, 'longitude' => $cached->longitude,
            ];
        }

        try {
            $response = Http::timeout(2)->get("http://ip-api.com/json/{$ip}", [
                'fields' => 'status,country,regionName,city,lat,lon',
            ]);
        } catch (\Throwable $e) {
            Log::debug('GeoLocator: lookup failed', ['ip' => $ip, 'error' => $e->getMessage()]);

            return $empty;
        }

        if (! $response->ok() || $response->json('status') !== 'success') {
            return $empty;
        }

        $result = [
            'city' => $response->json('city'),
            'region' => $response->json('regionName'),
            'country' => $response->json('country'),
            'latitude' => $response->json('lat'),
            'longitude' => $response->json('lon'),
        ];

        IpGeolocation::create([...$result, 'ip' => $ip, 'lookedUpAt' => now()]);

        return $result;
    }
}
