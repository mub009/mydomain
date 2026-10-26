<?php

namespace App\Support\GoldRates;

use App\Exceptions\ApiException;
use App\Models\GoldRate;

// Where the logo, each gold rate and each business detail sit on a
// template, and how each is written. Every position, size and font size is
// in the master PNG's own pixels, so the layout fits the original exactly
// however the editor is zoomed. resources/js/lib/gold-rate-render.js draws
// it — keep FONTS and the keys in step with that file.
//
// {
//   "logo":    { "visible": true, "source": "library", "x": 40, "y": 40, "width": 240, "height": 120 },
//   "fields":  { "24K": { "visible": true, "label": "24K Gold", "text": "{label}: {currency}{rate}",
//                         "currency": "₹", "fontFamily": "Poppins", "fontSize": 48, "fontWeight": 700,
//                         "color": "#111111", "align": "center", "background": null, …style keys,
//                         "x": 100, "y": 600, "width": 800, "height": 80 }, "22K": {…}, "21K": {…}, "18K": {…} },
//   "details": { "name": {…same as a rate, text "{name}"}, "phone": {…}, …,
//                "qr": { "visible": false, "target": "page", "color": "#000000", "background": "#ffffff", "x", "y", "width", "height" } }
// }
//
// logo.source "business" draws the linked business's own logo instead of
// the chosen library logo. Business details are filled in from the linked
// business when the poster is drawn (BusinessCard).
class TemplateLayout
{
    // System fonts plus the Google Fonts the editor page loads.
    public const FONTS = [
        'Poppins', 'Montserrat', 'Inter', 'Roboto', 'Oswald', 'Playfair Display', 'Noto Serif', 'Noto Sans Malayalam',
        'Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Trebuchet MS', 'Courier New',
    ];

    // Loaded on the Gold Rates tab and the editor so the canvas can draw
    // with them (resources/views/pages/admin/partials/gold-rate-fonts.blade.php).
    public const FONT_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900'
        .'&family=Montserrat:wght@400;500;600;700;800;900&family=Noto+Sans+Malayalam:wght@400;500;600;700;800;900'
        .'&family=Noto+Serif:wght@400;500;600;700;800;900&family=Oswald:wght@400;500;600;700'
        .'&family=Playfair+Display:wght@400;500;600;700;800;900&family=Poppins:wght@400;500;600;700;800;900'
        .'&family=Roboto:wght@400;500;600;700;800;900&display=swap';

    public const WEIGHTS = [400, 500, 600, 700, 800, 900];

    public const ALIGNS = ['left', 'center', 'right'];

    public const DESIGNS = ['plain', 'split'];

    // Business details that can go on the poster, each with its starting
    // text and the label a "label | value" design shows. The placeholders
    // are filled from the linked business (BusinessCard::vars()).
    public const DETAILS = [
        'name' => ['text' => '{name}', 'label' => 'Shop'],
        'phone' => ['text' => 'Call {phone}', 'label' => 'Call'],
        'address' => ['text' => '{address}', 'label' => 'Visit'],
        'website' => ['text' => '{website}', 'label' => 'Web'],
        'page' => ['text' => '{page}', 'label' => 'Markkito'],
        'instagram' => ['text' => 'Instagram {instagram}', 'label' => 'Instagram'],
        'facebook' => ['text' => '{facebook}', 'label' => 'Facebook'],
        'tagline' => ['text' => '{tagline}', 'label' => ''],
        'hours' => ['text' => '{hours}', 'label' => 'Today'],
    ];

    public const QR_TARGETS = ['page', 'website'];

    // Box styling (the editor's style presets), optional so layouts saved
    // before it still load. Matches FIELD_DEFAULTS in gold-rate-render.js.
    // A missing labelColor follows the text colour.
    public const FIELD_DEFAULTS = [
        'design' => 'plain', 'radius' => 0, 'borderColor' => null, 'borderWidth' => 0, 'background2' => null,
        'shadow' => false, 'labelColor' => null, 'labelBackground' => null, 'splitRatio' => 0.45,
        'shape' => 'rect', 'gradientDirection' => 'vertical', 'labelBackground2' => null, 'glowColor' => null, 'uppercase' => false,
    ];

    // The newer style keys; optional on a saved preset too.
    private const EXTRA_STYLE_RULES = [
        'shape' => ['sometimes', 'string', 'in:rect,ribbon,chamfer'],
        'gradientDirection' => ['sometimes', 'string', 'in:vertical,horizontal,diagonal'],
        'labelBackground2' => ['sometimes', 'nullable', 'string', self::COLOR],
        'glowColor' => ['sometimes', 'nullable', 'string', self::COLOR],
        'uppercase' => ['sometimes', 'boolean'],
    ];

    private const COLOR = 'regex:/^#[0-9a-fA-F]{6}$/';

    // A starting layout for a freshly uploaded template: a logo in the top
    // corner and the rates stacked in the lower half. 24K and 22K show by
    // default; the admin turns the others, and any business details, on as
    // needed. $logoRatio (width ÷ height) shapes the logo box to the logo
    // chosen at upload, so its outline fits the logo.
    public static function default(int $width, int $height, ?float $logoRatio = null): array
    {
        $logoWidth = round(min($width, $height) * 0.2, 2);
        $logoHeight = $logoRatio ? round($logoWidth / $logoRatio, 2) : $logoWidth;
        $margin = round(min($width, $height) * 0.05, 2);
        $rowHeight = round($height * 0.08, 2);
        $fields = [];
        foreach (GoldRate::PURITIES as $i => $purity) {
            $fields[$purity] = self::textBox([
                'visible' => in_array($purity, ['24K', '22K'], true),
                'label' => "{$purity} Gold",
                'text' => '{label}: {currency}{rate}',
                'currency' => '₹',
                'x' => round($width * 0.1, 2),
                'y' => round(min($height * 0.55 + $i * $rowHeight * 1.15, $height - $rowHeight), 2),
                'width' => round($width * 0.8, 2),
                'height' => $rowHeight,
            ]);
        }

        return [
            'logo' => ['visible' => true, 'source' => 'library', 'x' => $margin, 'y' => $margin, 'width' => $logoWidth,
                'height' => min($logoHeight, $height - $margin)],
            'fields' => $fields,
            'details' => self::defaultDetails($width, $height),
        ];
    }

    // Any part a layout saved earlier is missing (business details, the
    // logo source), filled in with its default.
    public static function complete(array $layout, int $width, int $height): array
    {
        if (! $layout) {
            return self::default($width, $height);
        }
        $layout['logo']['source'] ??= 'library';
        $layout['details'] = ($layout['details'] ?? []) + self::defaultDetails($width, $height);

        return $layout;
    }

    // Business details start hidden, stacked under the logo, with the QR
    // code in the bottom-right corner.
    private static function defaultDetails(int $width, int $height): array
    {
        $rowHeight = round($height * 0.05, 2);
        $details = [];
        $i = 0;
        foreach (self::DETAILS as $key => $defaults) {
            $details[$key] = self::textBox([
                'visible' => false,
                'label' => $defaults['label'],
                'text' => $defaults['text'],
                'currency' => '',
                'x' => round($width * 0.2, 2),
                'y' => round(min($height * 0.3 + $i++ * $rowHeight * 1.1, $height - $rowHeight), 2),
                'width' => round($width * 0.6, 2),
                'height' => $rowHeight,
            ]);
        }
        $size = round(min($width, $height) * 0.18, 2);
        $margin = round(min($width, $height) * 0.04, 2);
        $details['qr'] = [
            'visible' => false, 'target' => 'page', 'color' => '#000000', 'background' => '#ffffff',
            'x' => round($width - $size - $margin, 2), 'y' => round($height - $size - $margin, 2), 'width' => $size, 'height' => $size,
        ];

        return $details;
    }

    private static function textBox(array $box): array
    {
        return [
            'fontFamily' => 'Poppins',
            'fontSize' => round($box['height'] * 0.55, 2),
            'fontWeight' => 700,
            'color' => '#111111',
            'align' => 'center',
            'background' => null,
            ...self::FIELD_DEFAULTS,
            'labelColor' => '#111111',
            ...$box,
        ];
    }

    // Validation rules for a whole layout under `layout`, bounded by the
    // template's own size. Business details are optional (missing ones
    // keep their defaults).
    public static function rules(int $width, int $height): array
    {
        $box = fn (string $prefix) => [
            "{$prefix}.x" => ['required', 'numeric', 'min:0', "max:{$width}"],
            "{$prefix}.y" => ['required', 'numeric', 'min:0', "max:{$height}"],
            "{$prefix}.width" => ['required', 'numeric', 'min:1', "max:{$width}"],
            "{$prefix}.height" => ['required', 'numeric', 'min:1', "max:{$height}"],
        ];
        $textBox = fn (string $prefix, string $presence) => [
            $prefix => [$presence, 'array:visible,label,text,currency,fontFamily,fontSize,fontWeight,color,align,background,x,y,width,height,'
                .implode(',', array_keys(self::FIELD_DEFAULTS))],
            "{$prefix}.visible" => ['required', 'boolean'],
            "{$prefix}.label" => ['present', 'nullable', 'string', 'max:40'],
            "{$prefix}.text" => ['required', 'string', 'max:120'],
            "{$prefix}.currency" => ['present', 'nullable', 'string', 'max:8'],
            "{$prefix}.fontFamily" => ['required', 'string', 'in:'.implode(',', self::FONTS)],
            "{$prefix}.fontSize" => ['required', 'numeric', 'min:4', 'max:2000'],
            "{$prefix}.fontWeight" => ['required', 'integer', 'in:'.implode(',', self::WEIGHTS)],
            "{$prefix}.color" => ['required', 'string', self::COLOR],
            "{$prefix}.align" => ['required', 'string', 'in:'.implode(',', self::ALIGNS)],
            "{$prefix}.background" => ['present', 'nullable', 'string', self::COLOR],
            "{$prefix}.design" => ['sometimes', 'string', 'in:'.implode(',', self::DESIGNS)],
            "{$prefix}.radius" => ['sometimes', 'numeric', 'min:0', 'max:5000'],
            "{$prefix}.borderColor" => ['sometimes', 'nullable', 'string', self::COLOR],
            "{$prefix}.borderWidth" => ['sometimes', 'numeric', 'min:0', 'max:500'],
            "{$prefix}.background2" => ['sometimes', 'nullable', 'string', self::COLOR],
            "{$prefix}.shadow" => ['sometimes', 'boolean'],
            "{$prefix}.labelColor" => ['sometimes', 'nullable', 'string', self::COLOR],
            "{$prefix}.labelBackground" => ['sometimes', 'nullable', 'string', self::COLOR],
            "{$prefix}.splitRatio" => ['sometimes', 'numeric', 'min:0.15', 'max:0.85'],
            ...self::prefixed("{$prefix}.", self::EXTRA_STYLE_RULES),
            ...$box($prefix),
        ];

        $rules = [
            'layout' => ['required', 'array:logo,fields,details'],
            'layout.logo' => ['required', 'array:visible,source,x,y,width,height'],
            'layout.logo.visible' => ['required', 'boolean'],
            'layout.logo.source' => ['sometimes', 'string', 'in:library,business'],
            ...$box('layout.logo'),
            'layout.fields' => ['required', 'array:'.implode(',', GoldRate::PURITIES), 'required_array_keys:'.implode(',', GoldRate::PURITIES)],
            'layout.details' => ['sometimes', 'array:'.implode(',', [...array_keys(self::DETAILS), 'qr'])],
            'layout.details.qr' => ['sometimes', 'array:visible,target,color,background,x,y,width,height'],
            'layout.details.qr.visible' => ['required_with:layout.details.qr', 'boolean'],
            'layout.details.qr.target' => ['required_with:layout.details.qr', 'string', 'in:'.implode(',', self::QR_TARGETS)],
            'layout.details.qr.color' => ['required_with:layout.details.qr', 'string', self::COLOR],
            'layout.details.qr.background' => ['present_with:layout.details.qr', 'nullable', 'string', self::COLOR],
        ];
        foreach (GoldRate::PURITIES as $purity) {
            $rules += $textBox("layout.fields.{$purity}", 'required');
        }
        foreach (array_keys(self::DETAILS) as $key) {
            $prefix = "layout.details.{$key}";
            // Each part applies only when that detail is sent.
            foreach ($textBox($prefix, 'sometimes') as $path => $rule) {
                $rules[$path] = $path === $prefix ? $rule : ['exclude_without:'.$prefix, ...$rule];
            }
        }
        foreach ($box('layout.details.qr') as $path => $rule) {
            $rules[$path] = ['exclude_without:layout.details.qr', ...$rule];
        }

        return $rules;
    }

    // The layout moved onto a master image of another size: positions and
    // sizes follow each axis, and text, corners and borders scale by the
    // smaller factor so nothing grows out of its box. Same-size images
    // leave it untouched.
    public static function scale(array $layout, int $fromWidth, int $fromHeight, int $toWidth, int $toHeight): array
    {
        if ($fromWidth === $toWidth && $fromHeight === $toHeight) {
            return $layout;
        }
        $sx = $toWidth / $fromWidth;
        $sy = $toHeight / $fromHeight;
        $s = min($sx, $sy);
        $box = function (array $b) use ($sx, $sy, $toWidth, $toHeight) {
            $width = round(min(max($b['width'] * $sx, 1), $toWidth), 2);
            $height = round(min(max($b['height'] * $sy, 1), $toHeight), 2);

            return [
                ...$b,
                'x' => round(min($b['x'] * $sx, $toWidth - $width), 2),
                'y' => round(min($b['y'] * $sy, $toHeight - $height), 2),
                'width' => $width,
                'height' => $height,
            ];
        };
        $textBox = function (array $field) use ($box, $s) {
            $field = $box($field);
            $field['fontSize'] = round(max($field['fontSize'] * $s, 4), 2);
            foreach (['radius', 'borderWidth'] as $key) {
                if (isset($field[$key])) {
                    $field[$key] = round($field[$key] * $s, 2);
                }
            }

            return $field;
        };

        $scaled = ['logo' => $box($layout['logo']), 'fields' => array_map($textBox, $layout['fields'])];
        if (isset($layout['details'])) {
            foreach ($layout['details'] as $key => $detail) {
                $scaled['details'][$key] = $key === 'qr' ? $box($detail) : $textBox($detail);
            }
        }

        return $scaled;
    }

    // A saved preset's style, under `style`. Sizes are fractions of the box
    // height (radius, border, fontScale) so it fits a box of any size; the
    // label and currency stay with each rate.
    public static function presetRules(): array
    {
        return [
            'style' => ['required', 'array:design,background,background2,radius,borderColor,border,shadow,color,labelColor,'
                .'labelBackground,splitRatio,fontFamily,fontWeight,fontScale,text,align,'.implode(',', array_keys(self::EXTRA_STYLE_RULES))],
            'style.design' => ['required', 'string', 'in:'.implode(',', self::DESIGNS)],
            'style.background' => ['present', 'nullable', 'string', self::COLOR],
            'style.background2' => ['present', 'nullable', 'string', self::COLOR],
            'style.radius' => ['required', 'numeric', 'min:0', 'max:1'],
            'style.borderColor' => ['present', 'nullable', 'string', self::COLOR],
            'style.border' => ['required', 'numeric', 'min:0', 'max:0.5'],
            'style.shadow' => ['required', 'boolean'],
            'style.color' => ['required', 'string', self::COLOR],
            'style.labelColor' => ['required', 'string', self::COLOR],
            'style.labelBackground' => ['present', 'nullable', 'string', self::COLOR],
            'style.splitRatio' => ['required', 'numeric', 'min:0.15', 'max:0.85'],
            ...self::prefixed('style.', self::EXTRA_STYLE_RULES),
            'style.fontFamily' => ['required', 'string', 'in:'.implode(',', self::FONTS)],
            'style.fontWeight' => ['required', 'integer', 'in:'.implode(',', self::WEIGHTS)],
            'style.fontScale' => ['required', 'numeric', 'min:0.05', 'max:3'],
            'style.text' => ['required', 'string', 'max:120'],
            'style.align' => ['required', 'string', 'in:'.implode(',', self::ALIGNS)],
        ];
    }

    public static function normalizePreset(array $style): array
    {
        $color = fn ($value) => $value ? strtolower($value) : null;

        return [
            'design' => $style['design'],
            'background' => $color($style['background']),
            'background2' => $color($style['background2']),
            'radius' => round((float) $style['radius'], 4),
            'borderColor' => $color($style['borderColor']),
            'border' => round((float) $style['border'], 4),
            'shadow' => (bool) $style['shadow'],
            'color' => $color($style['color']),
            'labelColor' => $color($style['labelColor']),
            'labelBackground' => $color($style['labelBackground']),
            'splitRatio' => round((float) $style['splitRatio'], 3),
            ...self::extraStyle($style),
            'fontFamily' => $style['fontFamily'],
            'fontWeight' => (int) $style['fontWeight'],
            'fontScale' => round((float) $style['fontScale'], 4),
            'text' => (string) $style['text'],
            'align' => $style['align'],
        ];
    }

    private static function prefixed(string $prefix, array $rules): array
    {
        $out = [];
        foreach ($rules as $key => $rule) {
            $out[$prefix.$key] = $rule;
        }

        return $out;
    }

    // Shape, gradient direction, label gradient, glow and capitals, with
    // defaults for anything saved before they existed.
    private static function extraStyle(array $style): array
    {
        $style += self::FIELD_DEFAULTS;
        $color = fn ($value) => $value ? strtolower($value) : null;

        return [
            'shape' => $style['shape'],
            'gradientDirection' => $style['gradientDirection'],
            'labelBackground2' => $color($style['labelBackground2']),
            'glowColor' => $color($style['glowColor']),
            'uppercase' => (bool) $style['uppercase'],
        ];
    }

    // The validated layout with only the known keys and numbers rounded to
    // hundredths of a pixel. Rejects any box that runs off the template.
    public static function normalize(array $layout, int $width, int $height): array
    {
        $box = function (array $source, string $name) use ($width, $height) {
            $b = [];
            foreach (['x', 'y', 'width', 'height'] as $key) {
                $b[$key] = round((float) $source[$key], 2);
            }
            // Half a pixel of slack for rounding in the browser.
            if ($b['x'] + $b['width'] > $width + 0.5 || $b['y'] + $b['height'] > $height + 0.5) {
                throw ApiException::badRequest("The {$name} runs off the edge of the template");
            }

            return $b;
        };
        $color = fn ($value) => $value ? strtolower($value) : null;
        $textBox = function (array $f, string $name) use ($box, $color) {
            $f += self::FIELD_DEFAULTS;

            return [
                'visible' => (bool) $f['visible'],
                'label' => (string) ($f['label'] ?? ''),
                'text' => (string) $f['text'],
                'currency' => (string) ($f['currency'] ?? ''),
                'fontFamily' => $f['fontFamily'],
                'fontSize' => round((float) $f['fontSize'], 2),
                'fontWeight' => (int) $f['fontWeight'],
                'color' => strtolower($f['color']),
                'align' => $f['align'],
                'background' => $color($f['background']),
                'design' => $f['design'],
                'radius' => round((float) $f['radius'], 2),
                'borderColor' => $color($f['borderColor']),
                'borderWidth' => round((float) $f['borderWidth'], 2),
                'background2' => $color($f['background2']),
                'shadow' => (bool) $f['shadow'],
                'labelColor' => $color($f['labelColor']) ?? strtolower($f['color']),
                'labelBackground' => $color($f['labelBackground']),
                'splitRatio' => round((float) $f['splitRatio'], 3),
                ...self::extraStyle($f),
                ...$box($f, $name),
            ];
        };

        $fields = [];
        foreach (GoldRate::PURITIES as $purity) {
            $fields[$purity] = $textBox($layout['fields'][$purity], "{$purity} rate");
        }

        $sent = $layout['details'] ?? [];
        $details = self::defaultDetails($width, $height);
        foreach (array_keys(self::DETAILS) as $key) {
            if (isset($sent[$key])) {
                $details[$key] = $textBox($sent[$key], "{$key} box");
            }
        }
        if (isset($sent['qr'])) {
            $qr = $sent['qr'];
            $details['qr'] = [
                'visible' => (bool) $qr['visible'],
                'target' => $qr['target'],
                'color' => strtolower($qr['color']),
                'background' => $color($qr['background'] ?? null),
                ...$box($qr, 'QR code'),
            ];
        }

        return [
            'logo' => [
                'visible' => (bool) $layout['logo']['visible'],
                'source' => $layout['logo']['source'] ?? 'library',
                ...$box($layout['logo'], 'logo'),
            ],
            'fields' => $fields,
            'details' => $details,
        ];
    }
}
