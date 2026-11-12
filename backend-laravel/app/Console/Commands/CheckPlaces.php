<?php

namespace App\Console\Commands;

use App\Support\GooglePlaces;
use Illuminate\Console\Command;
use Illuminate\Http\Client\ConnectionException;

// Tests the Google Places API key (GOOGLE_PLACES_API_KEY) with one search
// and says why Google refuses it, if it does — the "Find your business on
// Google Maps" search on the card's Google review link and Social Media.
class CheckPlaces extends Command
{
    protected $signature = 'places:check {query=Markkito : What to search for}';

    protected $description = 'Check the Google Places API key with one search, and why Google refuses it';

    public function handle(): int
    {
        if (! GooglePlaces::configured()) {
            $this->error('GOOGLE_PLACES_API_KEY is empty: the search opens Google Maps instead.');

            return self::FAILURE;
        }
        try {
            $response = GooglePlaces::request((string) $this->argument('query'));
        } catch (ConnectionException $e) {
            $this->error('Could not reach Google: '.$e->getMessage());

            return self::FAILURE;
        }
        if ($response->failed()) {
            $this->error('Google refused the search (HTTP '.$response->status().').');
            $this->line(GooglePlaces::explain($response));
            $this->newLine();
            $this->line('Google\'s answer: '.mb_substr($response->body(), 0, 800));

            return self::FAILURE;
        }
        $places = GooglePlaces::places($response);
        $this->info('The key works: '.count($places).' place(s) found.');
        foreach ($places as $p) {
            $this->line("  {$p['name']} — {$p['address']}");
        }

        return self::SUCCESS;
    }
}
