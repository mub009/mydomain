import { describe, expect, it } from "vitest";
import { sanitizeSiteCss, sanitizeSiteHtml } from "@/modules/sites/sanitize";

// Published sites render on our own origin, so builder output must not be able
// to run code or reach for another document.
describe("sanitizeSiteHtml", () => {
  it("removes script tags and their contents", () => {
    const out = sanitizeSiteHtml('<h1>Hi</h1><script>steal(localStorage)</script><p>Bye</p>');
    expect(out).not.toMatch(/script/i);
    expect(out).not.toContain("steal");
    expect(out).toContain("<h1>Hi</h1>");
    expect(out).toContain("<p>Bye</p>");
  });

  it("removes inline event handlers in every quoting style", () => {
    const out = sanitizeSiteHtml(
      `<img src=x onerror="alert(1)"><div onclick='go()'>a</div><span onload=boom>b</span>`,
    );
    expect(out).not.toMatch(/on(error|click|load)\s*=/i);
    expect(out).toContain("<span>b</span>");
  });

  it("neutralises javascript: and data: URLs", () => {
    const out = sanitizeSiteHtml(`<a href="javascript:alert(1)">x</a><a href='data:text/html,<b>'>y</a>`);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/data:text\/html/i);
  });

  it("removes framing and credential-harvesting elements", () => {
    const out = sanitizeSiteHtml(
      '<iframe src="https://evil.test"></iframe><form action="https://evil.test"><input name="pw"></form><p>ok</p>',
    );
    expect(out).not.toMatch(/<(iframe|form)/i);
    expect(out).toContain("<p>ok</p>");
  });

  it("leaves ordinary markup untouched", () => {
    const html = '<section class="hero"><h1>Shop</h1><a href="tel:+919876543210">Call</a></section>';
    expect(sanitizeSiteHtml(html)).toBe(html);
  });
});

describe("sanitizeSiteCss", () => {
  it("strips @import, expression() and behavior", () => {
    const out = sanitizeSiteCss(
      '@import url("https://evil.test/x.css"); body{width:expression(alert(1))} .a{behavior:url(#x)}',
    );
    expect(out).not.toMatch(/@import|expression\s*\(|behavior\s*:/i);
  });

  // Regression: an unterminated declaration used to consume every rule after
  // it, silently deleting the owner's real styles.
  it("does not swallow the rules that follow an unterminated declaration", () => {
    const out = sanitizeSiteCss(".a{behavior:url(#x)} .ok{color:green}");
    expect(out).toContain(".ok{color:green}");

    const out2 = sanitizeSiteCss("body{width:expression(alert(1))} .keep{color:red}");
    expect(out2).toContain(".keep{color:red}");
  });

  it("leaves ordinary styles untouched", () => {
    const css = ".hero{background:#0f5132;padding:96px 24px}.btn:hover{background:#15803d}";
    expect(sanitizeSiteCss(css)).toBe(css);
  });
});
