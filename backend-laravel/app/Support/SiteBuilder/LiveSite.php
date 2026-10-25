<?php

namespace App\Support\SiteBuilder;

use App\Models\Business;
use App\Models\BusinessSite;
use DOMDocument;
use DOMElement;
use DOMXPath;

/**
 * Keeps a saved website in step with the listing. The parts of a page that
 * are drawn from the owner's details — header, slider, about, gallery,
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

    // Blocks that are added to a saved page that does not have them yet, next
    // to the section the template puts them beside. The gallery is filled
    // from its own panel section, so it appears once photos are uploaded
    // there even on a page saved before it existed.
    private const INSERTABLE = ['#gallery'];

    /**
     * The saved page with its live blocks refreshed. $business must be
     * loaded the way Helpers::buildContext expects; $placeholders is for
     * the builder (see there).
     *
     * @return array{html: string, css: string}
     */
    public static function render(Business $business, BusinessSite $site, bool $placeholders = false): array
    {
        $html = (string) $site->html;
        $css = (string) $site->css;
        if (trim($html) === '') {
            return ['html' => $html, 'css' => $css];
        }

        $fresh = TemplateRegistry::buildTemplate($business, $site->templateId, $placeholders);

        return [
            'html' => Sanitizer::sanitizeSiteHtml(self::merge($html, $fresh['html'])),
            // The template's own rules go first: the builder drops rules a
            // page doesn't use, so a block added since (say the gallery)
            // would otherwise be unstyled, while the saved rules after them
            // still win. The slider's timing depends on how many photos it
            // has, so those rules come last and override the saved ones.
            'css' => trim($fresh['css']."\n".$css."\n".$fresh['liveCss']),
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

        foreach (self::INSERTABLE as $selector) {
            $query = self::xpath($selector);
            $new = $freshPath->query($query, $freshRoot)->item(0);
            if ($new && $savedPath->query($query, $savedRoot)->length === 0) {
                self::insertBesideNeighbour($savedDoc->importNode($new, true), $new, $savedPath, $savedRoot);
            }
        }

        $out = '';
        foreach ($savedRoot->childNodes as $child) {
            $out .= $savedDoc->saveHTML($child);
        }

        return $out;
    }

    // Puts $node after the saved copy of the nearest earlier sibling (with an
    // id) of $fresh in the fresh render, or else before the nearest later one.
    private static function insertBesideNeighbour(DOMElement $node, DOMElement $fresh, DOMXPath $savedPath, DOMElement $savedRoot): void
    {
        foreach (['previousSibling', 'nextSibling'] as $direction) {
            for ($sibling = $fresh->{$direction}; $sibling; $sibling = $sibling->{$direction}) {
                if (! $sibling instanceof DOMElement || ! $sibling->hasAttribute('id')) {
                    continue;
                }
                $anchor = $savedPath->query(self::xpath('#'.$sibling->getAttribute('id')), $savedRoot)->item(0);
                if ($anchor) {
                    $direction === 'previousSibling'
                        ? $anchor->parentNode->insertBefore($node, $anchor->nextSibling)
                        : $anchor->parentNode->insertBefore($node, $anchor);

                    return;
                }
            }
        }
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
