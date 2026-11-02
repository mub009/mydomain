<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * The business categories from database/data/categories.php. Safe to run
 * again: a category with the same slug is updated, nothing is deleted.
 *   php artisan db:seed --class=CategorySeeder
 */
class CategorySeeder extends Seeder
{
    public function run(): void
    {
        foreach (require database_path('data/categories.php') as $row) {
            $slug = $row['slug'] ?? Str::slug(str_replace('&', 'and', $row['name']));
            Category::updateOrCreate(
                ['slug' => $slug],
                ['name' => $row['name'], 'description' => $row['description'] ?? null],
            );
        }
    }
}
