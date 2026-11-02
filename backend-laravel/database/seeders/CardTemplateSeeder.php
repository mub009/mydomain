<?php

namespace Database\Seeders;

use App\Support\Cards\StarterTemplates;
use Illuminate\Database\Seeder;

// The starter digital-visiting-card designs (App\Support\Cards\StarterTemplates).
// Safe to run again: only missing designs are added. Run after CategorySeeder,
// since most sets belong to a category.
class CardTemplateSeeder extends Seeder
{
    public function run(): void
    {
        StarterTemplates::install();
    }
}
