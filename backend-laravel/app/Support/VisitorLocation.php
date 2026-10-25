<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * Where the visitor said they are, from the `mk_loc` cookie the location
 * picker writes: a city name, or a "near me" point — never both. Read on
 * the server so the home and search pages render already narrowed to it.
 */
class VisitorLocation
{
    public const COOKIE = 'mk_loc';

    /**
     * @return array{city: string, geo: array{lat: float, lng: float}|null}
     */
    public static function from(Request $request): array
    {
        $raw = $request->cookie(self::COOKIE);
        $state = is_string($raw) ? json_decode($raw, true) : null;
        if (! is_array($state)) {
            return ['city' => '', 'geo' => null];
        }

        $geo = $state['geo'] ?? null;
        $validGeo = is_array($geo)
            && is_numeric($geo['lat'] ?? null) && is_numeric($geo['lng'] ?? null)
            && abs((float) $geo['lat']) <= 90 && abs((float) $geo['lng']) <= 180;

        return [
            'city' => $validGeo ? '' : mb_substr(trim((string) ($state['city'] ?? '')), 0, 100),
            'geo' => $validGeo ? ['lat' => (float) $geo['lat'], 'lng' => (float) $geo['lng']] : null,
        ];
    }
}
