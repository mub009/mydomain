/**
 * Sanitises builder-authored HTML/CSS before it is stored and served.
 *
 * A published site is rendered on our own origin, so anything a business owner
 * puts in the builder runs with our origin's privileges — it could read other
 * visitors' session tokens. Owners are semi-trusted (they can be dealers'
 * customers, or an account someone talked their way into), so scripts and
 * event handlers are stripped on the way in rather than trusted.
 *
 * This runs server-side on save so it cannot be bypassed by calling the API
 * directly.
 */

// Elements that can execute code or load an unrelated document.
const FORBIDDEN_TAGS = ["script", "object", "embed", "base", "link", "meta"];

// Maps are part of the standard business page, so an iframe is allowed when it
// points at Google's embed endpoint and nothing else.
const ALLOWED_IFRAME_SRC = /^https:\/\/(?:www\.|maps\.)?google\.com\/maps[?/][^"']*$/i;

function stripTag(html: string, tag: string): string {
  // Paired form, including anything nested inside.
  const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi");
  // Self-closing / unclosed form.
  const single = new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi");
  return html.replace(paired, "").replace(single, "");
}

// Drop every iframe whose src is not an allowed map embed.
function filterIframes(html: string): string {
  return html.replace(/<iframe\b[^>]*>(?:[\s\S]*?<\/iframe\s*>)?/gi, (tag) => {
    const src = /\bsrc\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
    // &amp; survives HTML-escaping of the query string; compare the decoded form.
    return ALLOWED_IFRAME_SRC.test(src.replace(/&amp;/g, "&")) ? tag : "";
  });
}

// Forms stay — the contact form is core to the page — but they must not be
// able to post anywhere. With no action/method they can only be handled by
// our own submit handler on the published page.
function neutraliseForms(html: string): string {
  return html.replace(/<form\b[^>]*>/gi, (tag) =>
    tag
      .replace(/\s(action|method|target|enctype)\s*=\s*"[^"]*"/gi, "")
      .replace(/\s(action|method|target|enctype)\s*=\s*'[^']*'/gi, "")
      .replace(/\s(action|method|target|enctype)\s*=\s*[^\s>]+/gi, ""),
  );
}

export function sanitizeSiteHtml(html: string): string {
  let clean = html;

  for (const tag of FORBIDDEN_TAGS) clean = stripTag(clean, tag);
  clean = filterIframes(clean);
  clean = neutraliseForms(clean);

  // Inline handlers: onclick="…", onerror='…', onload=… (unquoted).
  clean = clean
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");

  // javascript:/vbscript:/data: URLs in href/src/action attributes.
  clean = clean.replace(
    /\b(href|src|action|formaction|xlink:href)\s*=\s*(["'])\s*(?:javascript|vbscript|data)\s*:[^"']*\2/gi,
    '$1="#"',
  );
  clean = clean.replace(/\b(href|src|action)\s*=\s*(?:javascript|vbscript|data)\s*:[^\s>]*/gi, 'href="#"');

  return clean;
}

export function sanitizeSiteCss(css: string): string {
  // CSS can execute through legacy expression()/behavior: and can pull in
  // arbitrary documents through @import.
  //
  // Every pattern is bounded by [^;}] so it stops at the end of its own
  // declaration or rule. Without that bound, a declaration with no trailing
  // semicolon (".a{behavior:url(#x)}") would swallow every rule after it.
  return css
    .replace(/@import\b[^;}]*;?/gi, "")
    .replace(/[a-zA-Z-]+\s*:\s*expression\s*\([^;}]*\)?\s*;?/gi, "")
    .replace(/behavior\s*:\s*[^;}]*;?/gi, "")
    .replace(/javascript\s*:/gi, "");
}
