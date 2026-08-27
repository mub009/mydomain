<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api', fn ($request) => Limit::perMinutes(15, 300)->by($request->ip()));

        RateLimiter::for('auth', fn ($request) => Limit::perMinutes(15, 20)->by($request->ip())->response(
            fn () => response()->json([
                'success' => false,
                'error' => ['code' => 'RATE_LIMITED', 'message' => 'Too many auth attempts, try again later'],
            ], 429)
        ));
    }
}
