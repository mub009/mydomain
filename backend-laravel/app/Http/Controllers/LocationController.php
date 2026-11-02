<?php

namespace App\Http\Controllers;

use App\Models\State;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\Cache;

// The State / City drop-downs: every state with its city names, sorted.
// Seeded by Database\Seeders\StateCitySeeder (which clears this cache).
class LocationController extends Controller
{
    public const CACHE_KEY = 'locations:states-cities';

    public function index()
    {
        return ApiResponse::ok(self::all());
    }

    /** @return array<int, array{name: string, cities: array<int, string>}> */
    public static function all(): array
    {
        return Cache::remember(self::CACHE_KEY, now()->addDay(), fn () => State::with('cities')
            ->orderBy('name')
            ->get()
            ->map(fn (State $s) => [
                'name' => $s->name,
                'cities' => $s->cities->pluck('name')->sort(SORT_NATURAL | SORT_FLAG_CASE)->values()->all(),
            ])
            ->all());
    }
}
