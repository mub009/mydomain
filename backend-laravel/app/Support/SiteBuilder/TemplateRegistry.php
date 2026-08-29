<?php

namespace App\Support\SiteBuilder;

use App\Models\Business;
use App\Support\SiteBuilder\Templates\ClassicTemplate;
use App\Support\SiteBuilder\Templates\ElegantTemplate;
use App\Support\SiteBuilder\Templates\ModernTemplate;
use App\Support\SiteBuilder\Templates\VibrantTemplate;
use App\Support\SiteThemes;

class TemplateRegistry
{
    // Order matters — this is the order the picker shows them in, and the
    // first entry is what a business gets before it has chosen anything.
    private const TEMPLATES = [
        ClassicTemplate::class,
        ModernTemplate::class,
        ElegantTemplate::class,
        VibrantTemplate::class,
    ];

    public const DEFAULT_TEMPLATE_ID = ClassicTemplate::ID;

    // Falls back to the default rather than throwing: a template that was
    // renamed or retired must not lock an owner out of their own editor.
    public static function resolve(?string $templateId): string
    {
        foreach (self::TEMPLATES as $class) {
            if ($class::ID === $templateId) {
                return $class;
            }
        }

        return self::TEMPLATES[0];
    }

    public static function isKnown(string $templateId): bool
    {
        foreach (self::TEMPLATES as $class) {
            if ($class::ID === $templateId) {
                return true;
            }
        }

        return false;
    }

    // The catalogue the picker renders — everything but the builder itself.
    public static function choices(): array
    {
        return array_map(fn ($class) => [
            ...$class::meta(),
            'theme' => SiteThemes::resolve($class::ID),
        ], self::TEMPLATES);
    }

    /**
     * Renders a business's data through one of the designs. This is what
     * seeds a first draft in the builder, and what "apply this template"
     * produces. $business must have category, photos (sortOrder asc), hours
     * (dayOfWeek asc), and services (active, createdAt asc) already loaded.
     */
    public static function buildTemplate(Business $business, ?string $templateId = null): array
    {
        $class = self::resolve($templateId);
        $ctx = Helpers::buildContext($business);
        $built = $class::build($ctx);

        $category = $business->category?->name;

        return [
            'templateId' => $class::ID,
            'html' => $built['html'],
            'css' => $built['css'],
            // Echoed back to the editor so it can show what it drew the page from.
            'data' => [
                'name' => $business->name,
                'tagline' => $category ? "{$category} in {$business->city}" : $business->city,
                'description' => $business->description ?? '',
                'phone' => $business->phone,
                'email' => $business->email,
                'address' => collect([$business->addressLine1, $business->addressLine2, $business->city, $business->state, $business->postalCode])
                    ->filter()->implode(', '),
                'workingTime' => Helpers::summariseHours($business->hours),
                'instagram' => $business->instagramUsername,
                'logoUrl' => $business->logoUrl,
                'photoCount' => $business->photos->count(),
                'slideCount' => count($ctx['slides']),
                'serviceCount' => $business->services->count(),
            ],
        ];
    }
}
