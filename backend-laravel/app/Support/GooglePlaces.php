<?php

namespace App\Support;

use App\Exceptions\ApiException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
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
    public static function search(string $query, ?float $lat = null, ?float $lng = null, bool $explain = false): array
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
            // An admin (who can fix it) is told why; everyone else gets the short version.
            throw ApiException::badRequest($explain
                ? 'Google refused the search: '.self::explain($response).' (Server check: php artisan places:check)'
                : 'Google search is not working right now. Paste your Google Maps share link instead.');
        }

        return self::places($response);
    }

    /** The places in a Places API answer: id, name and address each. */
    public static function places(Response $response): array
    {
        return collect($response->json('places', []))
            ->filter(fn ($p) => is_string($p['id'] ?? null) && preg_match('/^[A-Za-z0-9_-]{10,255}$/', $p['id']))
            ->map(fn ($p) => [
                'id' => $p['id'],
                'name' => (string) ($p['displayName']['text'] ?? ''),
                'address' => (string) ($p['formattedAddress'] ?? ''),
            ])->values()->all();
    }

    /** One raw Text Search call (also for `php artisan places:check`). */
    public static function request(string $query): Response
    {
        $bundle = config('services.gemini.ca_bundle');

        return Http::timeout(10)
            ->withOptions($bundle ? ['verify' => $bundle] : [])
            ->withHeaders([
                'X-Goog-Api-Key' => (string) config('services.google_places.key'),
                'X-Goog-FieldMask' => 'places.id,places.displayName,places.formattedAddress',
            ])
            ->post(rtrim((string) config('services.google_places.base_url'), '/').'/v1/places:searchText', ['textQuery' => $query, 'pageSize' => 3]);
    }

    /**
     * Why Google refused, in words an admin can act on — from the reason in
     * its error (SERVICE_DISABLED, API_KEY_HTTP_REFERRER_BLOCKED, …), else
     * Google's own message.
     */
    public static function explain(Response $response): string
    {
        $error = $response->json('error') ?? [];
        $reasons = collect($error['details'] ?? [])->pluck('reason')->filter()->all();
        $message = (string) ($error['message'] ?? '');
        $has = fn (string $r) => in_array($r, $reasons, true);

        return match (true) {
            $has('SERVICE_DISABLED') || str_contains($message, 'has not been used') || str_contains($message, 'is disabled')
                => 'Places API (New) is not enabled in the Google Cloud project of this key. Enable "Places API (New)" (not only the old "Places API") in APIs & Services.',
            $has('API_KEY_HTTP_REFERRER_BLOCKED') || str_contains($message, 'referer')
                => 'The key only works from websites (HTTP referrers), but searches come from the server. Set the key\'s "Application restrictions" to None, or to IP addresses with your server\'s IP.',
            $has('API_KEY_IP_ADDRESS_BLOCKED') || str_contains($message, 'IP address')
                => 'The key is limited to other IP addresses. Add your server\'s IP to the key\'s "Application restrictions".',
            $has('API_KEY_SERVICE_BLOCKED') || str_contains($message, 'blocked')
                => 'This key may not call Places API (New). In the key\'s "API restrictions", add Places API (New) (or choose "Don\'t restrict key").',
            $has('BILLING_DISABLED') || str_contains(strtolower($message), 'billing')
                => 'Billing is not turned on for the Google Cloud project of this key. Link a billing account to it.',
            $has('API_KEY_INVALID') || str_contains($message, 'API key not valid')
                => 'The key is not valid. Copy it again from Google Cloud into GOOGLE_PLACES_API_KEY.',
            $message !== '' => $message,
            default => "Google answered with HTTP {$response->status()}.",
        };
    }
}
