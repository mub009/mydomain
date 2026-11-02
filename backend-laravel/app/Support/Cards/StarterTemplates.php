<?php

namespace App\Support\Cards;

use App\Models\Category;
use App\Models\CardTemplate;

// The card designs Markkito ships with: five for each of the main
// categories, and five general ones that every other category is offered.
// Installed by CardTemplateSeeder and the admin's "Install starter
// templates" button; both only add what is missing (matched on slug), so
// an admin's edits to a starter design are never overwritten.
class StarterTemplates
{
    private static function d(string $primary, string $accent, string $background, string $surface, string $text, string $muted, string $heading, string $body, string $button, string $buttonText = '#ffffff', float $overlay = 0.35): array
    {
        return [
            'colors' => compact('primary', 'accent', 'background', 'surface', 'text', 'muted') + ['buttonText' => $buttonText],
            'fonts' => ['heading' => $heading, 'body' => $body],
            'buttonStyle' => $button,
            'overlay' => $overlay,
        ];
    }

    /** category slugs => [name, layout, design][] ; null = general */
    public static function sets(): array
    {
        $restaurant = [
            ['Premium Restaurant', 'banner', self::d('#7c2d12', '#f59e0b', '#fff7ed', '#ffffff', '#1c1917', '#78716c', 'Playfair Display', 'Lora', 'rounded')],
            ['Modern Food Business', 'classic', self::d('#ea580c', '#16a34a', '#fff7ed', '#ffffff', '#1f2937', '#6b7280', 'Poppins', 'Inter', 'pill')],
            ['Traditional Restaurant', 'split', self::d('#991b1b', '#ca8a04', '#fef3c7', '#fffbeb', '#422006', '#854d0e', 'Cinzel', 'Lora', 'square', '#fef3c7')],
            ['Luxury Dining', 'luxury', self::d('#111111', '#d4af37', '#0b0b0b', '#141414', '#f5f5f4', '#a8a29e', 'Cormorant Garamond', 'Raleway', 'outline', '#111111', 0.55)],
            ['Minimal Food Card', 'minimal', self::d('#dc2626', '#f97316', '#fafafa', '#ffffff', '#171717', '#737373', 'DM Sans', 'DM Sans', 'soft')],
        ];
        $clinic = [
            ['Modern Medical', 'classic', self::d('#0891b2', '#10b981', '#ecfeff', '#ffffff', '#0f172a', '#64748b', 'Poppins', 'Inter', 'rounded')],
            ['Healthcare Blue', 'banner', self::d('#1d4ed8', '#38bdf8', '#eff6ff', '#ffffff', '#0f172a', '#475569', 'Montserrat', 'Open Sans', 'pill')],
            ['Premium Hospital', 'split', self::d('#0f766e', '#f59e0b', '#f0fdfa', '#ffffff', '#134e4a', '#5f7f7c', 'Merriweather', 'Open Sans', 'rounded')],
            ['Minimal Medical', 'minimal', self::d('#0284c7', '#22c55e', '#f8fafc', '#ffffff', '#0f172a', '#64748b', 'DM Sans', 'Inter', 'soft')],
            ['Professional Clinic', 'luxury', self::d('#1e3a8a', '#0ea5e9', '#f1f5f9', '#ffffff', '#0f172a', '#475569', 'Raleway', 'Nunito', 'outline')],
        ];

        return [
            'restaurants' => $restaurant,
            'electronics-and-appliances' => [
                ['Modern Technology', 'classic', self::d('#2563eb', '#06b6d4', '#eff6ff', '#ffffff', '#0f172a', '#64748b', 'Space Grotesk', 'Inter', 'rounded')],
                ['Dark Premium Electronics', 'banner', self::d('#0f172a', '#22d3ee', '#020617', '#0f172a', '#e2e8f0', '#94a3b8', 'Montserrat', 'Inter', 'pill', '#e0f2fe', 0.6)],
                ['Futuristic Design', 'split', self::d('#7c3aed', '#22d3ee', '#0b1020', '#111827', '#f3f4f6', '#9ca3af', 'Orbitron', 'Space Grotesk', 'square')],
                ['Minimal Gadget Store', 'minimal', self::d('#111827', '#3b82f6', '#f9fafb', '#ffffff', '#111827', '#6b7280', 'DM Sans', 'DM Sans', 'soft')],
                ['Professional Electronics', 'luxury', self::d('#1e40af', '#f97316', '#f8fafc', '#ffffff', '#0f172a', '#475569', 'Raleway', 'Roboto', 'outline')],
            ],
            'hospitals' => $clinic,
            'clinics-and-doctors' => $clinic,
            'jewellery' => [
                ['Luxury Gold', 'luxury', self::d('#92400e', '#d4a017', '#fffbeb', '#fffdf5', '#3f2a07', '#8a6d3b', 'Cinzel', 'Lora', 'rounded')],
                ['Premium Black & Gold', 'banner', self::d('#0a0a0a', '#d4af37', '#050505', '#111111', '#f5f5f4', '#a8a29e', 'Playfair Display', 'Raleway', 'outline', '#0a0a0a', 0.55)],
                ['Elegant Jewellery', 'classic', self::d('#9d174d', '#d4af37', '#fdf2f8', '#ffffff', '#3b0a24', '#9f647f', 'Cormorant Garamond', 'Josefin Sans', 'pill')],
                ['Royal Design', 'split', self::d('#4c1d95', '#eab308', '#faf5ff', '#ffffff', '#2e1065', '#6b5a8e', 'Cinzel', 'Merriweather', 'square', '#fef9c3')],
                ['Minimal Jewellery', 'minimal', self::d('#78350f', '#ca8a04', '#fafaf9', '#ffffff', '#1c1917', '#78716c', 'Great Vibes', 'Josefin Sans', 'soft')],
            ],
            '' => [
                ['Professional Blue', 'classic', self::d('#1d4ed8', '#f59e0b', '#eef2ff', '#ffffff', '#0f172a', '#64748b', 'Poppins', 'Inter', 'rounded')],
                ['Bold Banner', 'banner', self::d('#be123c', '#f97316', '#fff1f2', '#ffffff', '#1f2937', '#6b7280', 'Montserrat', 'Open Sans', 'pill')],
                ['Fresh Split', 'split', self::d('#047857', '#facc15', '#ecfdf5', '#ffffff', '#064e3b', '#4b7f6a', 'Nunito', 'Nunito', 'rounded')],
                ['Classic Elegance', 'luxury', self::d('#1f2937', '#b45309', '#f5f5f4', '#ffffff', '#1c1917', '#78716c', 'Playfair Display', 'Lora', 'outline')],
                ['Clean Minimal', 'minimal', self::d('#334155', '#0ea5e9', '#f8fafc', '#ffffff', '#0f172a', '#64748b', 'DM Sans', 'DM Sans', 'soft')],
            ],
        ];
    }

    /** Adds the starter designs that are missing. Returns how many were added. */
    public static function install(): int
    {
        $added = 0;
        foreach (self::sets() as $categorySlug => $templates) {
            $categoryId = null;
            if ($categorySlug !== '') {
                $categoryId = Category::where('slug', $categorySlug)->value('id');
                if (! $categoryId) {
                    continue;
                }
            }
            $prefix = $categorySlug ?: 'general';
            $hasDefault = CardTemplate::where('categoryId', $categoryId)->where('isDefault', true)->exists();
            foreach ($templates as $i => [$name, $layout, $design]) {
                $slug = $prefix.'-'.\Illuminate\Support\Str::slug(str_replace('&', 'and', $name));
                if (CardTemplate::where('slug', $slug)->exists()) {
                    continue;
                }
                CardTemplate::create([
                    'categoryId' => $categoryId,
                    'name' => $name,
                    'slug' => $slug,
                    'layout' => $layout,
                    'design' => $design,
                    'isDefault' => $i === 0 && ! $hasDefault,
                    'isActive' => true,
                    // The last two of each set are the premium ones.
                    'isPremium' => $i >= 3,
                    'sortOrder' => $i,
                ]);
                $added++;
            }
        }

        return $added;
    }
}
