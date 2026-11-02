<?php

namespace Database\Seeders;

use App\Http\Controllers\LocationController;
use App\Models\City;
use App\Models\State;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;

/**
 * Fills the State / City drop-downs from database/data/india-states-cities.php.
 * Safe to run again: only missing states and cities are added.
 *   php artisan db:seed --class=StateCitySeeder
 */
class StateCitySeeder extends Seeder
{
    public function run(): void
    {
        $data = require database_path('data/india-states-cities.php');

        foreach ($data as $row) {
            $state = State::updateOrCreate(['name' => $row['name']], ['code' => $row['code'] ?? null, 'country' => 'IN']);
            $existing = City::where('stateId', $state->id)->pluck('name')->map(fn ($n) => mb_strtolower($n))->all();
            foreach (array_unique($row['cities']) as $city) {
                if (! in_array(mb_strtolower($city), $existing, true)) {
                    City::create(['stateId' => $state->id, 'name' => $city]);
                    $existing[] = mb_strtolower($city);
                }
            }
        }

        Cache::forget(LocationController::CACHE_KEY);
    }
}
