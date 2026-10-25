<?php

namespace App\Support\SiteBuilder;

use App\Models\Business;
use App\Models\BusinessSite;
use DOMDocument;
use DOMElement;
use DOMXPath;

/**
 * Keeps a saved website in step with the listing. The parts of a page that
 * are drawn from the owner's details — header, slider, about, photos,
 * services, hours, map, contact details, footer — are swapped for freshly
 * rendered copies every time the page is shown, so a new phone number or
 * slider photo appears without anyone touching the builder. Everything
 * else the owner did in the builder (added blocks, moved or deleted
 * sections, styling) is left as saved.
 */
class LiveSite
{
    // Simple selectors (.class or #id) for the data-drawn blocks across all
    // templates. The nth match in the saved page is replaced by the nth
    // match in a fresh render; outer blocks come before blocks they contain.
    private const BLOCKS = [
        '.mk-header-inner', '.mk-hero-split', '.mk-top', '.mk-hero', '.mk-strip', '.mk-chips',
        '#about', '#gallery', '#services', '#hours', '.mk-social', '.mk-map-section',
        '.mk-contact-info', '.mk-footer', '.mk-float',
        // The Standard template's own markup.
        '.navbar-brand', '.main_banner', '.socail_feeds', '#map', '.contact_info', '#myButton',
    ];

    /**
     * The saved page with its live blocks refreshed. $business must be
     * loaded the way Helpers::buildContext expects.
     *
     * @return array{html: string, css: string}
     */
    public static function render(Business $business, BusinessSite $site): array
    {
        $html = (string) $site->html;
        $css = (string) $site->css;
        if (trim($html) === '') {
            return ['html' => $html, 'css' => $css];
        }

        $fresh = TemplateRegistry::buildTemplate($business, $site->templateId);

        return [
            'html' => Sanitizer::sanitizeSiteHtml(self::merge($html, $fresh['html'])),
            // The slider's timing depends on how many photos it has, so its
            // rules are re-sent after the saved ones, which they override.
            'css' => trim($css."\n".$fresh['liveCss']),
        ];
    }

    public static function merge(string $saved, string $fresh): string
    {
        [$savedDoc, $savedRoot] = self::parse($saved);
        [$freshDoc, $freshRoot] = self::parse($fresh);
        $savedPath = new DOMXPath($savedDoc);
        $freshPath = new DOMXPath($freshDoc);

        foreach (self::BLOCKS as $selector) {
            $query = self::xpath($selector);
            $replacements = iterator_to_array($freshPath->query($query, $freshRoot));
            foreach (iterator_to_array($savedPath->query($query, $savedRoot)) as $i => $old) {
                $new = $replacements[$i] ?? null;
                if (! $new) {
                    // The listing no longer has anything for this block.
                    $old->parentNode?->removeChild($old);

                    continue;
                }
                $node = $savedDoc->importNode($new, true);
                // The builder styles an element through an id it gives it,
                // so the block keeps the saved one.
                if ($old->hasAttribute('id') && ! $node->hasAttribute('id')) {
                    $node->setAttribute('id', $old->getAttribute('id'));
                }
                $old->parentNode?->replaceChild($node, $old);
            }
        }

        $out = '';
        foreach ($savedRoot->childNodes as $child) {
            $out .= $savedDoc->saveHTML($child);
        }

        return $out;
    }

    /** @return array{0: DOMDocument, 1: DOMElement} */
    private static function parse(string $html): array
    {
        $doc = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $doc->loadHTML('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="mk-live-root">'.$html.'</div></body></html>', LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        return [$doc, $doc->getElementById('mk-live-root')];
    }

    private static function xpath(string $selector): string
    {
        $name = substr($selector, 1);

        return $selector[0] === '#'
            ? ".//*[@id='{$name}']"
            : ".//*[contains(concat(' ', normalize-space(@class), ' '), ' {$name} ')]";
    }
}
