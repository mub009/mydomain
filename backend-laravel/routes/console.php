<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Only actually runs if the server has a system cron calling
// `php artisan schedule:run` every minute — see README "Deploying (shared
// hosting / cPanel)" for how to wire that up on cPanel.
Schedule::command('classifieds:expire')->daily();
// New listings/websites go to Google within minutes of going live, and the
// admin's SEO report is refreshed (App\Support\Seo\SeoTracker).
Schedule::command('seo:sync')->everyTenMinutes()->withoutOverlapping();
