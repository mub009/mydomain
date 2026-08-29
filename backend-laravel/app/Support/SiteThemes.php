<?php

namespace App\Support;

// The palette each design contributes to a storefront. An eCommerce site is
// rendered by the app rather than authored in the builder — the cart and
// checkout have to actually run — so the template choice comes through as a
// theme instead of as markup. The drag-and-drop brochure-website builder
// itself is not part of this port (see backend-laravel/README.md); this is
// only the read-only theme lookup `getPublishedSite` needs.
class SiteThemes
{
    public const DEFAULT_TEMPLATE_ID = 'classic';

    private const SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

    private const THEMES = [
        'classic' => [
            'accent' => '#e11d2e', 'accentAlt' => '#b91626', 'onAccent' => '#ffffff',
            'bg' => '#ffffff', 'surface' => '#f6f8fb', 'text' => '#12161c', 'muted' => '#6b7280',
            'line' => '#e8edf3', 'headerBg' => '#ffffff', 'headerText' => '#12161c',
            'radius' => '12px', 'font' => self::SANS, 'heading' => self::SANS, 'uppercase' => true,
        ],
        'modern' => [
            'accent' => '#f5b301', 'accentAlt' => '#ffc933', 'onAccent' => '#0d1015',
            'bg' => '#0d1015', 'surface' => '#161b22', 'text' => '#e8edf4', 'muted' => '#9aa6b6',
            'line' => '#242c37', 'headerBg' => '#0d1015', 'headerText' => '#ffffff',
            'radius' => '12px', 'font' => self::SANS, 'heading' => self::SANS, 'uppercase' => true,
        ],
        'elegant' => [
            'accent' => '#b08d5a', 'accentAlt' => '#96754a', 'onAccent' => '#ffffff',
            'bg' => '#faf7f2', 'surface' => '#ffffff', 'text' => '#2a251f', 'muted' => '#7a7267',
            'line' => '#e6ddce', 'headerBg' => '#faf7f2', 'headerText' => '#2a251f',
            'radius' => '2px', 'font' => self::SANS, 'heading' => 'Georgia,"Times New Roman",serif', 'uppercase' => true,
        ],
        'vibrant' => [
            'accent' => '#7c3aed', 'accentAlt' => '#ec4899', 'onAccent' => '#ffffff',
            'bg' => '#ffffff', 'surface' => '#faf8ff', 'text' => '#1b1236', 'muted' => '#6b6486',
            'line' => '#ece7f7', 'headerBg' => '#ffffff', 'headerText' => '#1b1236',
            'radius' => '22px', 'font' => self::SANS, 'heading' => self::SANS, 'uppercase' => false,
        ],
    ];

    // Falls back to the default rather than failing: a template that was
    // renamed or retired must not break a shop's published storefront.
    public static function resolve(?string $templateId): array
    {
        return self::THEMES[$templateId] ?? self::THEMES[self::DEFAULT_TEMPLATE_ID];
    }
}
