<?php

namespace App\Support;

// Picks an icon and tint for a category or showcase label by keyword, so
// categories added later still get a sensible picture.
class CategoryIcons
{
    // First match wins, so the more specific words come first (e.g.
    // "carpenter" before "car", "driving school" before "school").
    private const RULES = [
        [['driving', 'taxi', 'car service', 'car dealer', 'car rental', 'bike', 'tyre'], 'car', 'bg-blue-50 text-blue-600'],
        [['carpenter', 'painter', 'architect', 'building material', 'hardware'], 'hammer', 'bg-yellow-50 text-yellow-700'],
        [['pest'], 'shield', 'bg-lime-50 text-lime-700'],
        [['cleaning', 'laundry'], 'sparkles', 'bg-cyan-50 text-cyan-600'],
        [['lab', 'diagnostic'], 'flask-conical', 'bg-red-50 text-red-600'],
        [['dentist', 'pharmac', 'ayurved', 'homeopath', 'physio', 'optician'], 'heart-pulse', 'bg-red-50 text-red-600'],
        [['yoga'], 'dumbbell', 'bg-emerald-50 text-emerald-600'],
        [['training', 'music', 'dance', 'college'], 'graduation-cap', 'bg-indigo-50 text-indigo-600'],
        [['laptop repair', 'phone repair', 'appliance repair'], 'wrench', 'bg-slate-50 text-slate-600'],
        [['computer', 'laptop', 'digital', 'web design'], 'laptop', 'bg-sky-50 text-sky-600'],
        [['mobile', 'phone', 'electronic'], 'smartphone', 'bg-sky-50 text-sky-600'],
        [['bakery', 'bakeries', 'sweet', 'snack', 'caterer'], 'utensils-crossed', 'bg-orange-50 text-orange-600'],
        [['grocery', 'supermarket', 'fruit', 'vegetable', 'meat', 'fish'], 'shopping-bag', 'bg-green-50 text-green-700'],
        [['travel agent'], 'globe', 'bg-sky-50 text-sky-600'],
        [['wedding', 'event', 'party', 'banquet'], 'calendar-check-2', 'bg-fuchsia-50 text-fuchsia-600'],
        [['photograph'], 'image', 'bg-fuchsia-50 text-fuchsia-600'],
        [['lawyer', 'advocate', 'legal'], 'shield-check', 'bg-teal-50 text-teal-600'],
        [['accountant', 'insurance'], 'briefcase', 'bg-teal-50 text-teal-600'],
        [['real estate', 'property'], 'key-round', 'bg-amber-50 text-amber-600'],
        [['printing', 'flex'], 'printer', 'bg-slate-50 text-slate-600'],
        [['gift', 'toy'], 'package', 'bg-purple-50 text-purple-600'],
        [['jewel', 'florist'], 'star', 'bg-amber-50 text-amber-600'],
        [['book', 'stationery'], 'bookmark', 'bg-indigo-50 text-indigo-600'],
        [['tailor', 'boutique'], 'scissors', 'bg-rose-50 text-rose-600'],
        [['clothing', 'fashion', 'footwear'], 'shopping-bag', 'bg-rose-50 text-rose-600'],
        [['wholesale', 'trader'], 'factory', 'bg-violet-50 text-violet-600'],
        [['restaurant', 'food', 'dining', 'cafe'], 'utensils-crossed', 'bg-orange-50 text-orange-600'],
        [['hotel', 'lodge', 'stay', 'travel'], 'building-2', 'bg-sky-50 text-sky-600'],
        [['spa', 'beauty', 'parlour'], 'sparkles', 'bg-pink-50 text-pink-600'],
        [['home', 'decor', 'furniture', 'interior'], 'home', 'bg-amber-50 text-amber-600'],
        [['education', 'school', 'training', 'coaching'], 'graduation-cap', 'bg-indigo-50 text-indigo-600'],
        [['rent', 'hire', 'car', 'vehicle'], 'car', 'bg-blue-50 text-blue-600'],
        [['hospital', 'doctor', 'clinic', 'health', 'medical'], 'heart-pulse', 'bg-red-50 text-red-600'],
        [['contractor', 'construction', 'builder'], 'hammer', 'bg-yellow-50 text-yellow-700'],
        [['pet'], 'paw-print', 'bg-lime-50 text-lime-600'],
        [['gym', 'fitness'], 'dumbbell', 'bg-emerald-50 text-emerald-600'],
        [['loan', 'finance', 'bank'], 'briefcase', 'bg-teal-50 text-teal-600'],
        [['courier', 'packer', 'mover', 'logistics', 'delivery'], 'truck', 'bg-cyan-50 text-cyan-600'],
        [['repair', 'service', 'plumb', 'electric', 'home-services'], 'wrench', 'bg-slate-50 text-slate-600'],
        [['salon', 'barber'], 'scissors', 'bg-rose-50 text-rose-600'],
        [['manufactur', 'supply', 'supplies', 'b2b', 'industrial', 'wholesale'], 'factory', 'bg-violet-50 text-violet-600'],
        [['shop', 'retail', 'store'], 'shopping-bag', 'bg-brand-50 text-brand-700'],
        [['child', 'kids', 'baby'], 'baby', 'bg-purple-50 text-purple-600'],
    ];

    /**
     * @return array{icon: string, tint: string}
     */
    public static function for(string $label): array
    {
        $lower = mb_strtolower($label);
        foreach (self::RULES as [$keywords, $icon, $tint]) {
            foreach ($keywords as $keyword) {
                if (str_contains($lower, $keyword)) {
                    return ['icon' => $icon, 'tint' => $tint];
                }
            }
        }

        return ['icon' => 'store', 'tint' => 'bg-brand-50 text-brand-700'];
    }

    // Curated "explore" shortcuts shown on the home page — independent of the
    // live category tree. Clicking a tile runs a keyword search rather than a
    // strict category filter, since these are commonly searched terms.
    public const SHOWCASE = [
        ['title' => 'Wedding Requisites', 'items' => [
            ['label' => 'Banquet Halls', 'query' => 'banquet hall', 'seed' => 'banquet-halls'],
            ['label' => 'Bridal Requisite', 'query' => 'bridal', 'seed' => 'bridal-requisite'],
            ['label' => 'Caterers', 'query' => 'caterer', 'seed' => 'caterers'],
        ]],
        ['title' => 'Beauty & Spa', 'items' => [
            ['label' => 'Beauty Parlours', 'query' => 'beauty parlour', 'seed' => 'beauty-parlours'],
            ['label' => 'Spa & Massages', 'query' => 'spa massage', 'seed' => 'spa-massages'],
            ['label' => 'Salons', 'query' => 'salon', 'seed' => 'salons'],
        ]],
        ['title' => 'Repairs & Services', 'items' => [
            ['label' => 'AC Service', 'query' => 'ac service', 'seed' => 'ac-service'],
            ['label' => 'Car Service', 'query' => 'car service', 'seed' => 'car-service'],
            ['label' => 'Bike Service', 'query' => 'bike service', 'seed' => 'bike-service'],
        ]],
        ['title' => 'Daily Needs', 'items' => [
            ['label' => 'Grocery', 'query' => 'grocery', 'seed' => 'grocery'],
            ['label' => 'Electricians', 'query' => 'electrician', 'seed' => 'electricians'],
            ['label' => 'Laundry', 'query' => 'laundry', 'seed' => 'laundry'],
        ]],
    ];
}
