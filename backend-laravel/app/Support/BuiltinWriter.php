<?php

namespace App\Support;

/**
 * The free, offline description writer: no account, no network. It builds a
 * short description from the business's name, category, city and B2B/B2C
 * type out of phrases suited to the kind of business, picking different
 * wording each time so "Write with AI" gives a fresh take. Like the AI
 * writers it says nothing it can't know — no contact details, prices or
 * claims. Used when no AI service is set up, or one is unavailable.
 */
class BuiltinWriter
{
    // Kinds of business, recognised from words in the category (or name).
    private const KINDS = [
        'food' => ['restaurant', 'cafe', 'café', 'food', 'bakery', 'sweet', 'hotel', 'dhaba', 'catering', 'juice', 'tea', 'coffee', 'biryani', 'pizza', 'kitchen', 'mess', 'canteen'],
        'health' => ['clinic', 'hospital', 'doctor', 'dental', 'dentist', 'health', 'pharma', 'medical', 'physio', 'diagnostic', 'lab', 'ayurved', 'homeo', 'eye', 'care', 'cardio', 'nursing'],
        'beauty' => ['salon', 'beauty', 'spa', 'parlour', 'parlor', 'makeup', 'barber', 'grooming', 'nail', 'mehendi'],
        'fitness' => ['gym', 'fitness', 'yoga', 'sport', 'dance', 'martial', 'swim'],
        'education' => ['school', 'college', 'tuition', 'coaching', 'academy', 'training', 'education', 'institute', 'classes', 'learning'],
        'home' => ['home service', 'plumb', 'electric', 'repair', 'clean', 'pest', 'carpent', 'paint', 'interior', 'appliance', 'ac service', 'maintenance'],
        'auto' => ['car', 'bike', 'auto', 'garage', 'vehicle', 'tyre', 'tire', 'motor', 'workshop'],
        'b2b' => ['manufactur', 'supplier', 'supplies', 'wholesale', 'industrial', 'factory', 'trading', 'export', 'import', 'distributor', 'machinery', 'packaging'],
        'professional' => ['legal', 'lawyer', 'advocate', 'account', 'tax', 'consult', 'real estate', 'property', 'agency', 'travel', 'event', 'photograph', 'studio', 'insurance', 'finance'],
        'retail' => ['shop', 'store', 'mart', 'market', 'boutique', 'fashion', 'cloth', 'jewel', 'electronic', 'mobile', 'furniture', 'hardware', 'book', 'gift', 'toy', 'footwear', 'optical'],
    ];

    // Per kind: what the place is, what people come for, and why it's worth it.
    private const PHRASES = [
        'food' => [
            'what' => ['a welcoming place to eat', 'a friendly spot for good food', 'a neighbourhood favourite for a satisfying meal'],
            'for' => ['freshly prepared dishes, made with care and served with a smile', 'tasty, honest food for a quick bite or a relaxed meal with family and friends', 'a comfortable place to sit down, eat well and enjoy good company'],
            'why' => ['Drop in when you are hungry, or call ahead to plan your visit.', 'It is an easy choice for everyday meals as well as get-togethers.', 'Come by and see what is cooking today.'],
        ],
        'health' => [
            'what' => ['a caring place for your health', 'a trusted local name for health and care', 'a patient-friendly centre for everyday health needs'],
            'for' => ['attentive care with time taken to listen and explain', 'professional, considerate treatment in a calm and clean setting', 'help with your health concerns from people who put patients first'],
            'why' => ['Get in touch to ask about appointments and services.', 'Call to find a time that suits you.', 'Reach out with any questions before your visit.'],
        ],
        'beauty' => [
            'what' => ['a place to look and feel your best', 'a relaxing spot for beauty and grooming', 'a friendly salon for everyday care and special occasions'],
            'for' => ['careful, personal attention whether you want a quick refresh or a complete new look', 'treatments and styling done with skill, hygiene and an eye for detail', 'a calm, comfortable visit that leaves you feeling refreshed'],
            'why' => ['Call ahead to book a time that works for you.', 'Get in touch to ask about services and availability.', 'Treat yourself to a visit soon.'],
        ],
        'fitness' => [
            'what' => ['a motivating place to get active', 'a welcoming space to work on your fitness', 'a friendly local centre for staying fit and healthy'],
            'for' => ['support for beginners and regulars alike, at a pace that suits you', 'a positive, encouraging environment to build healthy habits', 'guidance and a good space to train, whatever your goals'],
            'why' => ['Get in touch to ask about timings and joining.', 'Drop by to see the space and find out more.', 'Start your fitness journey with a call or a visit.'],
        ],
        'education' => [
            'what' => ['a dedicated place to learn and grow', 'a supportive centre for learning', 'a trusted local name in education and training'],
            'for' => ['focused teaching that helps students build confidence and understanding', 'guidance that makes learning clear, practical and engaging', 'patient, structured support for learners at every stage'],
            'why' => ['Get in touch to ask about courses, batches and admissions.', 'Call or visit to find the right programme for you.', 'Reach out to learn how to get started.'],
        ],
        'home' => [
            'what' => ['a dependable choice for work around the home', 'a reliable local service for your home', 'a trusted name for keeping homes in good shape'],
            'for' => ['careful, tidy work done properly the first time', 'prompt help with the jobs that keep your home running smoothly', 'practical solutions from people who take pride in their work'],
            'why' => ['Call to describe the job and arrange a visit.', 'Get in touch to book a time that suits you.', 'Reach out whenever you need a hand at home.'],
        ],
        'auto' => [
            'what' => ['a dependable place for your vehicle', 'a trusted local stop for vehicle care', 'a reliable workshop for keeping you on the road'],
            'for' => ['honest, careful work on your car or bike', 'attention to detail that keeps your vehicle running safely', 'clear advice and work done with care'],
            'why' => ['Call ahead to book your vehicle in.', 'Get in touch to explain what you need.', 'Drop by or call to arrange a time.'],
        ],
        'b2b' => [
            'what' => ['a dependable supply partner for businesses', 'a reliable source for businesses that need quality and consistency', 'a business-focused supplier you can build a long-term relationship with'],
            'for' => ['dependable products and a straightforward, responsive way of working', 'consistent quality and clear communication from enquiry to delivery', 'support for regular orders as well as specific requirements'],
            'why' => ['Get in touch to discuss your requirements and request a quote.', 'Contact the team to talk about quantities, specifications and timelines.', 'Send an enquiry to start the conversation.'],
        ],
        'professional' => [
            'what' => ['a trusted local name for professional help', 'a dependable partner for advice and services', 'a client-focused practice that keeps things simple'],
            'for' => ['clear, practical guidance and work handled with care', 'a personal approach that takes the time to understand what you need', 'dependable service from people who keep you informed'],
            'why' => ['Get in touch to discuss what you need.', 'Call or send an enquiry to arrange a conversation.', 'Reach out to find out how they can help.'],
        ],
        'retail' => [
            'what' => ['a friendly local shop', 'a go-to store for everyday needs', 'a well-loved local place to shop'],
            'for' => ['a good range and helpful service to find what you are looking for', 'friendly advice and an easy, pleasant shopping experience', 'quality choices and people happy to help you pick the right one'],
            'why' => ['Visit the store or call to check what is available.', 'Drop in and have a look around.', 'Get in touch to ask about what you need.'],
        ],
        'general' => [
            'what' => ['a trusted local business', 'a friendly, dependable local name', 'a customer-focused business'],
            'for' => ['good service and a genuine commitment to the people it serves', 'a helpful, straightforward experience from first contact onwards', 'care and attention for every customer'],
            'why' => ['Get in touch to find out more.', 'Call or send an enquiry to see how they can help.', 'Reach out with any questions.'],
        ],
    ];

    public static function businessDescription(string $name, string $category, ?string $city = null, ?string $businessType = null): string
    {
        $kind = self::kindOf($category, $name);
        if ($kind === 'general' && $businessType === 'B2B') {
            $kind = 'b2b';
        }
        $p = self::PHRASES[$kind];
        $pick = fn (array $options) => $options[array_rand($options)];

        $where = $city ? " in {$city}" : '';
        $categoryText = mb_strtolower($category);
        $audience = $businessType === 'B2B' ? 'businesses' : 'customers';

        $openings = [
            "{$name} is {$pick($p['what'])}{$where}, listed on Markkito under {$categoryText}.",
            "{$name} is {$pick($p['what'])}{$where}.",
        ];
        if ($city) {
            $openings[] = "Based in {$city}, {$name} is {$pick($p['what'])}.";
        }
        $opening = $pick($openings);
        $offer = ucfirst($audience)." come to {$name} for ".$pick($p['for']).'.';
        $close = $pick($p['why']);

        // The business's name is the user's own text: keep it as typed.
        return trim(preg_replace('/\s+/', ' ', "{$opening} {$offer} {$close}"));
    }

    /**
     * A search snippet from the same phrases: a title of name, category and
     * city, a description that fits Google's ~155 characters, and the search
     * phrases people use for that kind of business in that city. AiWriter
     * trims anything over the limits.
     *
     * @param  array{name: string, category: string, city?: ?string, businessType?: ?string, services?: array<int, string>}  $facts
     * @return array{seoTitle: string, seoDescription: string, seoKeywords: string}
     */
    public static function seo(array $facts): array
    {
        $name = $facts['name'];
        $category = $facts['category'];
        $city = $facts['city'] ?? null;
        $kind = self::kindOf($category, $name);
        if ($kind === 'general' && ($facts['businessType'] ?? null) === 'B2B') {
            $kind = 'b2b';
        }
        $p = self::PHRASES[$kind];
        $pick = fn (array $options) => $options[array_rand($options)];
        $where = $city ? " in {$city}" : '';

        $title = "{$name} — {$category}{$where}";
        if (mb_strlen($title) > 60) {
            $title = "{$name}{$where}";
        }

        // The longest wording that still fits in a search result.
        $description = '';
        foreach ([$pick($p['for']), ...$p['for']] as $for) {
            $candidate = "{$name}, {$pick($p['what'])}{$where}: {$for}. {$pick($p['why'])}";
            if (mb_strlen($candidate) <= 160) {
                $description = $candidate;
                break;
            }
        }
        if ($description === '') {
            $description = "{$name} — ".mb_strtolower($category)."{$where}. {$pick($p['why'])}";
        }

        $type = mb_strtolower($category);
        $place = $city ? mb_strtolower($city) : null;
        $keywords = array_filter([
            mb_strtolower($name),
            $place ? "{$type} in {$place}" : $type,
            $place ? "best {$type} {$place}" : null,
            "{$type} near me",
            ...array_map(fn ($s) => mb_strtolower($s).($place ? " {$place}" : ''), array_slice($facts['services'] ?? [], 0, 4)),
            $place,
        ]);

        return [
            'seoTitle' => $title,
            'seoDescription' => $description,
            'seoKeywords' => implode(', ', array_unique($keywords)),
        ];
    }

    private static function kindOf(string $category, string $name): string
    {
        foreach ([$category, $name] as $text) {
            $text = mb_strtolower($text);
            foreach (self::KINDS as $kind => $words) {
                foreach ($words as $word) {
                    // From the start of a word, so "tea" isn't found in
                    // "steam" (but "manufactur" still finds "manufacturing").
                    if (preg_match('/(^|[^\p{L}])'.preg_quote($word, '/').'/u', $text)) {
                        return $kind;
                    }
                }
            }
        }

        return 'general';
    }
}
