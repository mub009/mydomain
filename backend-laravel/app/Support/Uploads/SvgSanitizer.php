<?php

namespace App\Support\Uploads;

use DOMDocument;
use DOMElement;
use DOMNode;

/**
 * Strips anything executable out of an uploaded SVG.
 *
 * SVG is XML, so unlike a raster image it can carry <script>, event-handler
 * attributes, and javascript:/data: URLs — and it is served back from our
 * own origin, so an unsanitised one runs with our origin's privileges. This
 * walks the parsed DOM (not a regex over the raw text) so a script split
 * across nested tags or a re-encoded attribute cannot slip through.
 */
class SvgSanitizer
{
    private const FORBIDDEN_ELEMENTS = [
        'script', 'foreignobject', 'iframe', 'embed', 'object', 'audio', 'video',
        'animate', 'animatetransform', 'animatemotion', 'set', 'handler', 'listener',
    ];

    /**
     * @return array{svg: string, removed: string[]}
     */
    public static function sanitize(string $source): array
    {
        $doc = new DOMDocument();
        // External entities are not substituted (PHP's default since 8.0),
        // so this alone is not an XXE vector; LIBXML_NONET additionally
        // blocks any network fetch a malicious DOCTYPE might attempt.
        $doc->substituteEntities = false;
        libxml_use_internal_errors(true);
        $ok = $doc->loadXML($source, LIBXML_NONET);
        libxml_clear_errors();

        if (! $ok || ! $doc->documentElement || strtolower($doc->documentElement->localName ?? $doc->documentElement->nodeName) !== 'svg') {
            throw new \InvalidArgumentException('That file is not an SVG drawing');
        }

        $removed = [];
        self::scrub($doc->documentElement, $removed);

        return [
            'svg' => $doc->saveXML($doc->documentElement),
            'removed' => array_values(array_unique($removed)),
        ];
    }

    private static function scrub(DOMElement $node, array &$removed): void
    {
        // Snapshot first: removing a child while iterating the live NodeList
        // would skip whatever shifted into the current index.
        $children = iterator_to_array($node->childNodes);

        foreach ($children as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }
            $name = strtolower($child->localName ?? $child->nodeName);

            if (in_array($name, self::FORBIDDEN_ELEMENTS, true)) {
                $node->removeChild($child);
                $removed[] = "<{$name}>";

                continue;
            }

            self::scrubAttributes($child, $removed);
            self::scrub($child, $removed);
        }
    }

    private static function scrubAttributes(DOMElement $element, array &$removed): void
    {
        // Snapshot for the same reason as above — removeAttribute() while
        // iterating the live attribute map skips entries.
        $attributes = iterator_to_array($element->attributes ?? []);

        foreach ($attributes as $attribute) {
            $attrName = strtolower($attribute->name);
            $value = $attribute->value ?? '';

            if (str_starts_with($attrName, 'on') || preg_match('#javascript\s*:#i', $value)) {
                $element->removeAttribute($attribute->name);
                $removed[] = $attrName;

                continue;
            }

            if (in_array($attrName, ['href', 'xlink:href', 'src'], true)) {
                if (! self::safeReference($value)) {
                    $element->removeAttribute($attribute->name);
                    $removed[] = "{$attrName} to ".substr($value, 0, 40);
                }

                continue;
            }

            if ($attrName === 'style') {
                $element->setAttribute('style', self::safeCss($value));
            }
        }
    }

    // A reference that stays inside this document, or carries its own bytes.
    private static function safeReference(string $value): bool
    {
        $trimmed = trim($value);

        return str_starts_with($trimmed, '#')
            || (bool) preg_match('#^data:image/(png|jpeg|jpg|gif|webp);base64,#i', $trimmed);
    }

    // Strips url(...) that points anywhere but this document, and @import.
    private static function safeCss(string $css): string
    {
        $css = preg_replace('#@import[^;]*;?#i', '', $css);

        return preg_replace_callback('#url\(\s*([\'"]?)([^\'")]*)\1\s*\)#i', function ($m) {
            return self::safeReference($m[2]) ? $m[0] : 'none';
        }, $css);
    }
}
