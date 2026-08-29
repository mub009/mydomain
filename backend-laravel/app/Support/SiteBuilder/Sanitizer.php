<?php

namespace App\Support\SiteBuilder;

/**
 * Sanitises builder-authored HTML/CSS before it is stored and served.
 *
 * A published site is rendered on our own origin, so anything a business
 * owner puts in the builder runs with our origin's privileges — it could
 * read other visitors' session tokens. Owners are semi-trusted (they can be
 * dealers' customers, or an account someone talked their way into), so
 * scripts and event handlers are stripped on the way in rather than
 * trusted.
 *
 * This runs server-side on save so it cannot be bypassed by calling the API
 * directly.
 */
class Sanitizer
{
    // Elements that can execute code or load an unrelated document.
    private const FORBIDDEN_TAGS = ['script', 'object', 'embed', 'base', 'link', 'meta'];

    // Maps are part of the standard business page, so an iframe is allowed
    // when it points at Google's embed endpoint and nothing else.
    private const ALLOWED_IFRAME_SRC = '#^https://(?:www\.|maps\.)?google\.com/maps[?/][^"\']*$#i';

    private static function stripTag(string $html, string $tag): string
    {
        // Paired form, including anything nested inside.
        $paired = "#<{$tag}\\b[^>]*>[\\s\\S]*?</{$tag}\\s*>#i";
        // Self-closing / unclosed form.
        $single = "#<{$tag}\\b[^>]*/?>#i";

        return preg_replace($single, '', preg_replace($paired, '', $html));
    }

    // Drop every iframe whose src is not an allowed map embed.
    private static function filterIframes(string $html): string
    {
        return preg_replace_callback('#<iframe\b[^>]*>(?:[\s\S]*?</iframe\s*>)?#i', function ($m) {
            $tag = $m[0];
            preg_match('#\bsrc\s*=\s*["\']([^"\']*)["\']#i', $tag, $srcMatch);
            $src = $srcMatch[1] ?? '';
            // &amp; survives HTML-escaping of the query string; compare the
            // decoded form.
            return preg_match(self::ALLOWED_IFRAME_SRC, str_replace('&amp;', '&', $src)) ? $tag : '';
        }, $html);
    }

    // Forms stay — the contact form is core to the page — but they must not
    // be able to post anywhere. With no action/method they can only be
    // handled by our own submit handler on the published page.
    private static function neutraliseForms(string $html): string
    {
        return preg_replace_callback('#<form\b[^>]*>#i', function ($m) {
            $tag = $m[0];
            $tag = preg_replace('#\s(action|method|target|enctype)\s*=\s*"[^"]*"#i', '', $tag);
            $tag = preg_replace('#\s(action|method|target|enctype)\s*=\s*\'[^\']*\'#i', '', $tag);
            $tag = preg_replace('#\s(action|method|target|enctype)\s*=\s*[^\s>]+#i', '', $tag);

            return $tag;
        }, $html);
    }

    public static function sanitizeSiteHtml(string $html): string
    {
        $clean = $html;

        foreach (self::FORBIDDEN_TAGS as $tag) {
            $clean = self::stripTag($clean, $tag);
        }
        $clean = self::filterIframes($clean);
        $clean = self::neutraliseForms($clean);

        // Inline handlers: onclick="…", onerror='…', onload=… (unquoted).
        $clean = preg_replace('#\son[a-z]+\s*=\s*"[^"]*"#i', '', $clean);
        $clean = preg_replace('#\son[a-z]+\s*=\s*\'[^\']*\'#i', '', $clean);
        $clean = preg_replace('#\son[a-z]+\s*=\s*[^\s>]+#i', '', $clean);

        // javascript:/vbscript:/data: URLs in href/src/action attributes.
        $clean = preg_replace(
            '#\b(href|src|action|formaction|xlink:href)\s*=\s*(["\'])\s*(?:javascript|vbscript|data)\s*:[^"\']*\2#i',
            '$1="#"',
            $clean
        );
        $clean = preg_replace('#\b(href|src|action)\s*=\s*(?:javascript|vbscript|data)\s*:[^\s>]*#i', 'href="#"', $clean);

        return $clean;
    }

    public static function sanitizeSiteCss(string $css): string
    {
        // CSS can execute through legacy expression()/behavior: and can pull
        // in arbitrary documents through @import.
        //
        // Every pattern is bounded by [^;}] so it stops at the end of its
        // own declaration or rule. Without that bound, a declaration with no
        // trailing semicolon (".a{behavior:url(#x)}") would swallow every
        // rule after it.
        $css = preg_replace('#@import\b[^;}]*;?#i', '', $css);
        $css = preg_replace('#[a-zA-Z-]+\s*:\s*expression\s*\([^;}]*\)?\s*;?#i', '', $css);
        $css = preg_replace('#behavior\s*:\s*[^;}]*;?#i', '', $css);
        $css = preg_replace('#javascript\s*:#i', '', $css);

        return $css;
    }
}
