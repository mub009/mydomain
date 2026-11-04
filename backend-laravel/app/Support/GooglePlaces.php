<?php

namespace App\Support;

use App\Exceptions\ApiException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Google Places API (New) Text Search (config/services.php
 * "google_places"): finds a business on Google from its name and city, so
 * an owner can pick it and have its Place ID saved — no link to copy.
 * Asks only for the ID, name and address of each match.
 */
class GooglePlaces
{
    public static function configured(): bool
    {
        return (bool) config('services.google_places.key');
    }

    /**
     * Places matching $query, nearest $lat/$lng first when given.
     *
     * @return array<int, array{id: string, name: string, address: string}>
     */
    public static function search(string $query, ?float $lat = null, ?float $lng = null): array
    {
        if (! self::configured()) {
            throw ApiException::badRequest('Google search is not set up. Paste your Google Maps share link instead.');
        }

        $body = ['textQuery' => mb_substr(trim($query), 0, 200), 'pageSize' => 8];
        if ($lat !== null && $lng !== null) {
            $body['locationBias'] = ['circle' => ['center' => ['latitude' => $lat, 'longitude' => $lng], 'radius' => 20000.0]];
        }
        $bundle = config('services.gemini.ca_bundle');

        try {
            $response = Http::timeout(10)
                ->withOptions($bundle ? ['verify' => $bundle] : [])
                ->withHeaders([
                    'X-Goog-Api-Key' => config('services.google_places.key'),
                    'X-Goog-FieldMask' => 'places.id,places.displayName,places.formattedAddress',
                ])
                ->post(rtrim((string) config('services.google_places.base_url'), '/').'/v1/places:searchText', $body);
        } catch (ConnectionException $e) {
            Log::warning('Google Places search failed', ['message' => $e->getMessage()]);
            throw ApiException::badRequest('Could not reach Google just now. Try again, or paste your Google Maps share link.');
        }

        if ($response->failed()) {
            // A wrong key, the API not enabled, or billing off: the admin's to fix, not the owner's.
            Log::warning('Google Places search failed', ['status' => $response->status(), 'body' => mb_substr($response->body(), 0, 500)]);
            throw ApiException::badRequest('Google search is not working right now. Paste your Google Maps share link instead.');
        }

        return collect($response->json('places', []))
            ->filter(fn ($p) => is_string($p['id'] ?? null) && preg_match('/^[A-Za-z0-9_-]{10,255}$/', $p['id']))
            ->map(fn ($p) => [
                'id' => $p['id'],
                'name' => (string) ($p['displayName']['text'] ?? ''),
                'address' => (string) ($p['formattedAddress'] ?? ''),
            ])->values()->all();
    }
}
