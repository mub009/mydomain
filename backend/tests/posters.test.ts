import { describe, expect, it } from "vitest";
import { PosterSize } from "@prisma/client";
import { escapeXml, fitText, initials } from "@/modules/posters/text";
import { displayPhone, fillPlaceholders, PosterSubject, unknownPlaceholders } from "@/modules/posters/placeholders";
import { POSTER_LAYOUTS, POSTER_SIZES, posterFrame, renderPosterSvg, resolveLayout } from "@/modules/posters/layouts";
import { PALETTES, resolvePalette } from "@/modules/posters/palettes";
import { offlineBands, offlineSuggestions } from "@/modules/posters/copywriter";
import { MAX_ARTWORK_BYTES, readUploadedImage } from "@/modules/posters/upload";
import { inlineImage } from "@/modules/posters/assets";
import QRCode from "qrcode";
import { env } from "@/config/env";
import { businessQrDataUrl, clearQrCache } from "@/modules/posters/qr";
import { promptWantsQr, qrCornerFromPrompt } from "@/modules/posters/placeholders";
import { generatePosterImage, openAiConfigured } from "@/modules/posters/imageEngine";
import { dataUriDimensions, imageDimensions } from "@/modules/posters/imageSize";
import { fillSvgTemplate, sanitizeSvg, svgDimensions, svgSlots } from "@/modules/posters/svgTemplate";

const subject: PosterSubject = {
  name: "Spice Route Kitchen",
  phone: "919876543210",
  city: "Kozhikode",
  state: "Kerala",
  category: "Restaurants",
  address: "12 Beach Road",
  website: "https://spiceroute.example/",
  email: "hi@spiceroute.example",
  logoUrl: null,
  avgRating: 4.6,
  reviewCount: 128,
  slug: "spice-route-kitchen",
  pageUrl: "http://localhost:5173/business/spice-route-kitchen",
};

describe("fitText", () => {
  it("wraps at the width it was given", () => {
    const { lines } = fitText("Great food at great prices every single day", {
      maxWidth: 400,
      fontSize: 40,
      maxLines: 5,
    });
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe("Great food at great prices every single day");
  });

  // A headline is set enormous; two words too many must shrink the type, not
  // run off the edge of the poster.
  it("shrinks the type rather than overflowing the line budget", () => {
    const roomy = fitText("Short one", { maxWidth: 800, fontSize: 100, maxLines: 2 });
    const cramped = fitText(
      "An unusually long festival greeting that nobody should have typed into a headline field",
      { maxWidth: 800, fontSize: 100, maxLines: 2 },
    );
    expect(roomy.fontSize).toBe(100);
    expect(cramped.fontSize).toBeLessThan(100);
    expect(cramped.lines.length).toBeLessThanOrEqual(2);
  });

  it("truncates once shrinking has hit its floor", () => {
    const { lines } = fitText("word ".repeat(120), { maxWidth: 300, fontSize: 40, maxLines: 2 });
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
  });

  // A pasted URL has no spaces to break on.
  it("hard-splits a word longer than the line", () => {
    const { lines } = fitText("supercalifragilisticexpialidocious", { maxWidth: 120, fontSize: 40, maxLines: 4 });
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("supercalifragilisticexpialidocious");
  });

  it("returns nothing for empty text instead of a blank line", () => {
    expect(fitText("   ", { maxWidth: 400, fontSize: 40, maxLines: 2 }).lines).toEqual([]);
  });
});

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Spice Route Kitchen")).toBe("SR");
    expect(initials("Anil")).toBe("A");
    expect(initials("   ")).toBe("?");
  });
});

describe("placeholders", () => {
  it("fills the tokens a design is written with", () => {
    expect(fillPlaceholders("{{business_name}} in {{city}} — call {{phone}}", subject)).toBe(
      "Spice Route Kitchen in Kozhikode — call +91 98765 43210",
    );
  });

  // The prompt carries business details as @tokens, so the same data can be
  // handed to whatever generates the image.
  it("fills @tokens the same way", () => {
    expect(fillPlaceholders("Poster for @business_name in @city, phone @phone", subject)).toBe(
      "Poster for Spice Route Kitchen in Kozhikode, phone +91 98765 43210",
    );
  });

  it("mixes both syntaxes without complaint", () => {
    expect(fillPlaceholders("@business_name — {{city}}", subject)).toBe("Spice Route Kitchen — Kozhikode");
  });

  // An admin pasting an email into a prompt must not have it eaten: the "@"
  // there is an address, not a token.
  it("leaves an email address alone", () => {
    expect(fillPlaceholders("Write to hi@spiceroute.example about @city", subject)).toBe(
      "Write to hi@spiceroute.example about Kozhikode",
    );
    expect(unknownPlaceholders("mail me at anil@example.com")).toEqual([]);
  });

  it("keeps the older {{business}} spelling working", () => {
    expect(fillPlaceholders("{{business}}", subject)).toBe("Spice Route Kitchen");
    expect(fillPlaceholders("@business", subject)).toBe("Spice Route Kitchen");
    expect(unknownPlaceholders("{{business}} @mobile")).toEqual([]);
  });

  it("reports an @token nothing will fill", () => {
    expect(unknownPlaceholders("@bussiness_name and @phone")).toEqual(["bussiness_name"]);
    expect(fillPlaceholders("@bussiness_name", subject)).toBe("@bussiness_name");
  });

  it("is forgiving about spacing and case", () => {
    expect(fillPlaceholders("{{ Business_Name }}", subject)).toBe("Spice Route Kitchen");
  });

  // Blanking a typo would silently eat words; leaving it makes it visible in
  // the preview, and the editor warns about it before publishing.
  it("leaves an unknown placeholder visible", () => {
    expect(fillPlaceholders("Hi {{bussiness}}", subject)).toBe("Hi {{bussiness}}");
    expect(unknownPlaceholders("Hi {{bussiness}} in {{city}}")).toEqual(["bussiness"]);
  });

  it("tidies up after a value that is empty for this shop", () => {
    const noSite = { ...subject, website: null };
    expect(fillPlaceholders("Visit {{website}} today", noSite)).toBe("Visit today");
  });

  it("strips the scheme and trailing slash off a website", () => {
    expect(fillPlaceholders("{{website}}", subject)).toBe("spiceroute.example");
  });

  it("prints a stored number the way it appears on a board", () => {
    expect(displayPhone("919876543210")).toBe("+91 98765 43210");
    expect(displayPhone("9876543210")).toBe("98765 43210");
    // An unrecognised shape is passed through rather than mangled.
    expect(displayPhone("+44 7700 900123")).toBe("+44 7700 900123");
  });
});

describe("escapeXml", () => {
  // Business names come from the owner's account and go straight into markup.
  it("neutralises a name that would otherwise break the document", () => {
    expect(escapeXml(`Bob's "Diner" <b>&`)).toBe("Bob&apos;s &quot;Diner&quot; &lt;b&gt;&amp;");
  });
});

// Renders every layout at every size, which is the cheapest way to catch a
// layout that throws or emits something that is not a document.
describe("renderPosterSvg", () => {
  const copy = {
    headline: "Happy Onam from Spice Route Kitchen",
    subheadline: "Call +91 98765 43210 or drop in — we're at 12 Beach Road.",
    ctaText: "Call us today",
    badgeText: "20% OFF",
    footnote: "Spice Route Kitchen · Kozhikode",
    headerText: "",
    footerText: "",
  };

  const sizes = Object.keys(POSTER_SIZES) as PosterSize[];

  it.each(POSTER_LAYOUTS.map((l) => l.id))("renders %s at every size", (layoutId) => {
    for (const size of sizes) {
      const { svg, width, height } = renderPosterSvg(
        { size, palette: PALETTES[0], copy, subject, logoHref: null, backgroundHref: null },
        layoutId,
      );
      expect(svg.startsWith("<svg"), `${layoutId}/${size}`).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
      expect({ width, height }).toEqual({ width: POSTER_SIZES[size].width, height: POSTER_SIZES[size].height });
      // Every layout must print the number — a poster nobody can call is
      // pointless, and it is the one thing the request was about.
      expect(svg, `${layoutId}/${size} is missing the phone number`).toContain("+91 98765 43210");
      // No NaN leaking out of the geometry into an attribute.
      expect(svg).not.toContain("NaN");
    }
  });

  it("falls back to a monogram when the shop has no logo", () => {
    const { svg } = renderPosterSvg(
      { size: "SQUARE", palette: PALETTES[0], copy, subject, logoHref: null, backgroundHref: null },
      "spotlight",
    );
    expect(svg).toContain(">SR</text>");
    expect(svg).not.toContain("<image");
  });

  it("embeds the logo when one was inlined", () => {
    const { svg } = renderPosterSvg(
      {
        size: "SQUARE",
        palette: PALETTES[0],
        copy,
        subject,
        logoHref: "data:image/png;base64,iVBORw0KGgo=",
        backgroundHref: null,
      },
      "spotlight",
    );
    expect(svg).toContain("data:image/png;base64,iVBORw0KGgo=");
    expect(svg).toContain("clip-path=");
  });

  // Optional wording is genuinely optional — a design with only a headline
  // must still produce a poster.
  it("survives a design with nothing but a headline", () => {
    const { svg } = renderPosterSvg(
      {
        size: "PORTRAIT",
        palette: PALETTES[2],
        copy: { headline: "Now open", subheadline: "", ctaText: "", badgeText: "", footnote: "", headerText: "", footerText: "" },
        subject,
        logoHref: null,
        backgroundHref: null,
      },
      "minimal",
    );
    expect(svg).toContain("Now open");
    expect(svg).not.toContain("NaN");
  });

  it("falls back to the first layout and palette for an unknown id", () => {
    expect(resolveLayout("does-not-exist").id).toBe(POSTER_LAYOUTS[0].id);
    expect(resolvePalette(null).id).toBe(PALETTES[0].id);
  });
});

/**
 * Reads the text back out of a rendered poster and works out where each line
 * actually sits, using the same width estimate the renderer wraps with. This
 * is what catches the overflow class of bug — a business name that ran off
 * the right edge because letter-spacing was left out of the wrap width, or a
 * subheadline pushed under the contact bar by a headline one line too tall.
 */
interface TextExtent {
  text: string;
  left: number;
  right: number;
  bottom: number;
}

function textExtents(svg: string): TextExtent[] {
  const out: TextExtent[] = [];

  for (const block of svg.matchAll(/<text ([^>]*)>(.*?)<\/text>/g)) {
    const attrs = block[1];
    const attr = (name: string) => attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1];

    const fontSize = Number(attr("font-size") ?? 0);
    const anchor = attr("text-anchor") ?? "start";
    const tracking = Number(attr("letter-spacing") ?? 0);
    // A deliberately independent yardstick — slightly wider than the one the
    // renderer wraps with. Importing the renderer's own estimate would make
    // this test move whenever that estimate moved, and catch nothing.
    const em: Record<string, number> = { "400": 0.54, "600": 0.58, "700": 0.6, "800": 0.62 };
    const body = block[2];
    const caps = /[A-Z]/.test(body) && !/[a-z]/.test(body.replace(/<[^>]*>/g, ""));
    const perChar = fontSize * (em[attr("font-weight") ?? "700"] ?? 0.6) * (caps ? 1.2 : 1) + tracking;

    let y = Number(attr("y") ?? 0);
    for (const span of block[2].matchAll(/<tspan x="([^"]*)" dy="([^"]*)">(.*?)<\/tspan>/g)) {
      const x = Number(span[1]);
      y += Number(span[2]);
      const text = span[3];
      const width = text.length * perChar;
      const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
      out.push({ text, left, right: left + width, bottom: y + fontSize * 0.22 });
    }

    // Single-line labels (the monogram, the CTA) have no tspans.
    if (!block[2].includes("<tspan")) {
      const x = Number(attr("x") ?? 0);
      const text = block[2];
      const width = text.length * perChar;
      const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
      out.push({ text, left, right: left + width, bottom: y + fontSize * 0.22 });
    }
  }
  return out;
}

// The copy nobody should type, which somebody will: a 42-character business
// name, a headline that wants four lines, a three-line subheadline, plus a
// badge and a button — all on the tightest size.
describe("worst-case copy stays inside the poster", () => {
  const crowded: PosterSubject = {
    ...subject,
    name: "Sree Padmanabha Ayurvedic Wellness Centre",
    city: "Thiruvananthapuram",
    category: "Health & Medical",
    address: "44/2B Temple Junction, Fort",
    avgRating: 4.9,
    reviewCount: 2140,
  };

  const copy = {
    headline: "Wishing all our customers a very happy and prosperous Onam season",
    subheadline:
      "Rated 4.9 by 2140 happy customers across Thiruvananthapuram. Call +91 98765 43210 to book today.",
    ctaText: "Book a consultation",
    badgeText: "30% OFF",
    footnote: "Sree Padmanabha Ayurvedic Wellness Centre · Thiruvananthapuram",
    headerText: "",
    footerText: "",
  };

  const cases = POSTER_LAYOUTS.flatMap((l) => (Object.keys(POSTER_SIZES) as PosterSize[]).map((s) => [l.id, s] as const));

  it.each(cases)("%s at %s keeps every line on the canvas", (layoutId, size) => {
    const { svg, width, height } = renderPosterSvg(
      { size, palette: PALETTES[0], copy, subject: crowded, logoHref: null, backgroundHref: null },
      layoutId,
    );

    // No layout intends type to touch the bleed, so the safe area — not the
    // canvas — is the bound worth asserting.
    const inset = width * 0.02;

    for (const line of textExtents(svg)) {
      expect(line.left, `"${line.text}" starts off the left edge`).toBeGreaterThanOrEqual(inset - 1);
      expect(line.right, `"${line.text}" runs past the right edge`).toBeLessThanOrEqual(width - inset + 1);
      expect(line.bottom, `"${line.text}" runs past the bottom edge`).toBeLessThanOrEqual(height - inset + 1);
    }
  });

  // The headline is the message and the number is the point; everything else
  // may be sacrificed to fit, but never these two.
  it.each(cases)("%s at %s still carries the headline and the number", (layoutId, size) => {
    const { svg } = renderPosterSvg(
      { size, palette: PALETTES[0], copy, subject: crowded, logoHref: null, backgroundHref: null },
      layoutId,
    );
    expect(svg).toContain("+91 98765 43210");
    expect(svg).toMatch(/Wishing all our/i);
  });
});

describe("offline copywriter", () => {
  it("writes offer copy when there is an offer", () => {
    const [first] = offlineSuggestions({ tone: "bold", offer: "20% off", count: 1 });
    expect(first.headline).toContain("20% off");
    expect(first.badgeText).toBe("20% OFF");
  });

  it("writes greetings when there is an occasion", () => {
    const [first] = offlineSuggestions({ tone: "warm", occasion: "diwali", count: 1 });
    expect(first.headline).toContain("Diwali");
    expect(first.headline).toContain("{{business}}");
  });

  it("returns as many distinct options as asked for", () => {
    const suggestions = offlineSuggestions({ tone: "premium", count: 4 });
    expect(suggestions).toHaveLength(4);
    expect(new Set(suggestions.map((s) => s.headline)).size).toBe(4);
  });

  // The same brief twice must not reshuffle the preview under the admin.
  it("is deterministic", () => {
    const brief = { tone: "playful" as const, occasion: "onam", count: 3 };
    expect(offlineSuggestions(brief)).toEqual(offlineSuggestions(brief));
  });

  it("always writes copy that carries the shop's own details", () => {
    for (const tone of ["warm", "bold", "premium", "playful"] as const) {
      for (const suggestion of offlineSuggestions({ tone, count: 3 })) {
        expect(suggestion.subheadline, tone).toContain("{{phone}}");
      }
    }
  });
});

// A designer supplies the finished poster; the platform adds only the bands
// and the logo. Nothing may be drawn over the artwork uninvited.
describe("uploaded artwork", () => {
  const copy = {
    headline: "",
    subheadline: "",
    ctaText: "",
    badgeText: "",
    footnote: "",
    headerText: "{{business_name}}",
    footerText: "Trusted in {{city}}",
  };

  const art = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

  const render = (over: Partial<Parameters<typeof renderPosterSvg>[0]> = {}) =>
    renderPosterSvg(
      {
        size: "PORTRAIT",
        palette: PALETTES[0],
        copy: { ...copy, headerText: "Spice Route Kitchen", footerText: "Trusted in Kozhikode" },
        subject,
        logoHref: null,
        backgroundHref: art,
        ...over,
      },
      "artwork",
    ).svg;

  it("fills the poster with the artwork and still prints the number", () => {
    const svg = render();
    expect(svg).toContain(art);
    expect(svg).toContain("+91 98765 43210");
    expect(svg).toContain("Spice Route Kitchen");
    expect(svg).toContain("Trusted in Kozhikode");
  });

  it("draws nothing but the artwork when both bands are off", () => {
    const svg = render({ showHeader: false, showFooter: false, logoPosition: "none" });
    expect(svg).toContain(art);
    expect(svg).not.toContain("<text");
  });

  // The corner spots are for artwork that left a space; they must actually
  // move, or the option is a lie.
  it("puts the logo where it was told to", () => {
    const positions = ["top-left", "top-right", "bottom-left", "bottom-right", "center"] as const;
    const centres = positions.map((logoPosition) => {
      const svg = render({ logoPosition, logoHref: "data:image/png;base64,iVBORw0KGgo=" });
      const circle = svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)"/);
      return `${circle?.[1]},${circle?.[2]}`;
    });
    expect(new Set(centres).size).toBe(positions.length);
  });

  it("scales the logo when asked", () => {
    const radius = (scale: number) => {
      const svg = render({ logoPosition: "top-left", logoScale: scale });
      return Number(svg.match(/<circle cx="[\d.]+" cy="[\d.]+" r="([\d.]+)"/)?.[1]);
    };
    expect(radius(2)).toBeGreaterThan(radius(0.5));
  });

  it("leaves the logo out entirely for artwork that is already branded", () => {
    const svg = render({ logoPosition: "none", logoHref: "data:image/png;base64,iVBORw0KGgo=" });
    // The artwork itself is the only <image>; no logo was added.
    expect(svg.match(/<image /g)).toHaveLength(1);
  });
});

describe("readUploadedImage", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  it("accepts a real PNG and returns it as a data URI", () => {
    const result = readUploadedImage({ buffer: png });
    expect(result.type).toBe("image/png");
    expect(result.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  // The browser's declared mimetype is not evidence; the bytes are.
  it("rejects a file that only claims to be an image", () => {
    expect(() => readUploadedImage({ buffer: Buffer.from("MZ\u0000\u0000not an image") })).toThrow(/not an SVG, PNG/i);
    // Opens like markup, is not a drawing — the parser is what decides.
    expect(() => readUploadedImage({ buffer: Buffer.from("<html>not an image</html>") })).toThrow();
  });

  // An SVG is a document — it can carry script — and this file is about to be
  // embedded in a document the platform serves from its own origin. It is
  // taken anyway, because a template's slots can be filled exactly, but only
  // after the parser has stripped it.
  it("accepts an SVG and hands back a stripped one", () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">' +
        '<script>alert(1)</script><text x="10" y="20">@CLINIC_NAME@</text></svg>',
    );
    const result = readUploadedImage({ buffer: svg });

    expect(result.type).toBe("image/svg+xml");
    expect(result.dimensions).toEqual({ width: 1080, height: 1350 });
    expect(result.slots).toEqual(["business_name"]);
    expect(result.unknownSlots).toEqual([]);
    expect(result.removed).toContain("<script>");
    expect(Buffer.from(result.dataUrl.split(",")[1], "base64").toString()).not.toMatch(/script/i);
  });

  // The sniff only decides which validator runs; the parser is what judges.
  it("rejects a file that opens like XML but is not a drawing", () => {
    expect(() => readUploadedImage({ buffer: Buffer.from("<html><body>hi</body></html>") })).toThrow();
  });

  it("refuses an empty upload and one over the size cap", () => {
    expect(() => readUploadedImage({ buffer: Buffer.alloc(0) })).toThrow(/no file/i);
    const huge = Buffer.concat([png, Buffer.alloc(MAX_ARTWORK_BYTES)]);
    expect(() => readUploadedImage({ buffer: huge })).toThrow(/larger than/i);
  });
});

describe("inlineImage", () => {
  // Uploaded artwork arrives already encoded; re-fetching it would be absurd.
  it("passes a raster data URI straight through", async () => {
    const uri = "data:image/jpeg;base64,/9j/4AAQ";
    await expect(inlineImage(uri)).resolves.toBe(uri);
  });

  it("refuses an SVG data URI, which would be a document not a picture", async () => {
    await expect(inlineImage("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).resolves.toBeNull();
  });

  it("refuses anything that is not http(s)", async () => {
    for (const url of ["javascript:alert(1)", "file:///etc/passwd", "/relative.png", ""]) {
      await expect(inlineImage(url), url).resolves.toBeNull();
    }
  });
});

describe("offline bands", () => {
  it("identifies the shop and picks a logo spot", () => {
    const [first] = offlineBands({ prompt: "premium clinic", count: 1 });
    expect(first.headerText).toContain("{{business}}");
    expect(first.logoPosition).toBe("header");
  });

  it("never repeats a suggestion", () => {
    const bands = offlineBands({ prompt: "anything", count: 5 });
    expect(new Set(bands.map((b) => b.headerText + b.footerText)).size).toBe(5);
  });

  // The footer sits directly above the number, so repeating it there is noise.
  it("keeps the phone out of the footer line", () => {
    for (const band of offlineBands({ prompt: "x", count: 5 })) {
      expect(band.footerText).not.toContain("{{phone}}");
    }
  });
});

// A solid bar in a colour picked from a palette is a slab pasted over someone
// else's work. The bands have to take their colour from the design.
describe("bands match the artwork", () => {
  const art = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
  const copy = {
    headline: "",
    subheadline: "",
    ctaText: "",
    badgeText: "",
    footnote: "",
    headerText: "Spice Route Kitchen",
    footerText: "Trusted in Kozhikode",
  };

  const render = (over: Record<string, unknown> = {}) =>
    renderPosterSvg(
      {
        size: "PORTRAIT",
        palette: PALETTES[0],
        copy,
        subject,
        logoHref: null,
        backgroundHref: art,
        ...over,
      } as Parameters<typeof renderPosterSvg>[0],
      "artwork",
    ).svg;

  it("uses the sampled colour rather than the palette accent", () => {
    const svg = render({ bandColor: "#b8860b", bandTextColor: "#241701" });
    expect(svg).toContain("#b8860b");
    expect(svg).toContain("#241701");
    expect(svg).not.toContain(PALETTES[0].accent);
  });

  it("falls back to the palette when nothing was sampled", () => {
    expect(render()).toContain(PALETTES[0].accent);
  });

  it("draws each style differently", () => {
    const solid = render({ bandStyle: "solid", bandColor: "#b8860b" });
    const gradient = render({ bandStyle: "gradient", bandColor: "#b8860b" });
    const glass = render({ bandStyle: "glass", bandColor: "#b8860b" });
    const none = render({ bandStyle: "none", bandColor: "#b8860b" });

    // Faded means a gradient the solid bar does not have.
    expect(gradient).toContain("linearGradient");
    expect(solid).not.toContain("linearGradient");
    // Frosted lets the artwork through.
    expect(glass).toContain('opacity="0.55"');
    // No panel at all — but the type must still be legible on a busy design.
    expect(none).not.toMatch(/<rect x="0" y="\d+(\.\d+)?" width="1080"/);
    expect(none).toContain("feDropShadow");
  });

  // The shadow is for type only; a logo already carries its own plate.
  it("keeps the logo out of the drop shadow", () => {
    const svg = render({ bandStyle: "none", logoPosition: "top-left", logoHref: "data:image/png;base64,iVBORw0KGgo=" });
    const shadowed = svg.slice(svg.indexOf('<g filter="url(#band-shadow)">'), svg.indexOf("</g>"));
    expect(shadowed).not.toContain("<image");
  });

  // These values land in an SVG fill attribute, so nothing but hex gets in.
  it("refuses a colour that is not a hex value", () => {
    for (const bad of ['red" onload="alert(1)', "url(#x)", "javascript:alert(1)", "rgb(1,2,3)"]) {
      const svg = render({ bandColor: bad });
      expect(svg, bad).not.toContain(bad);
      expect(svg).toContain(PALETTES[0].accent);
    }
  });
});

// A QR to the shop's own page, printed on the poster so it can be scanned off
// a phone screen or a shop window.
describe("business QR", () => {
  const art = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
  const qr = "data:image/png;base64,UVJDT0RF";
  const copy = {
    headline: "",
    subheadline: "",
    ctaText: "",
    badgeText: "",
    footnote: "",
    headerText: "Spice Route Kitchen",
    footerText: "",
  };

  const render = (over: Record<string, unknown> = {}) =>
    renderPosterSvg(
      {
        size: "PORTRAIT",
        palette: PALETTES[0],
        copy,
        subject,
        logoHref: null,
        backgroundHref: art,
        ...over,
      } as Parameters<typeof renderPosterSvg>[0],
      "artwork",
    ).svg;

  /** Where the QR's white plate ended up, or null when none was drawn. */
  const plate = (svg: string) => {
    const match = svg.match(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="[\d.]+" rx="[\d.]+" fill="#ffffff"\/>/);
    return match ? { x: Number(match[1]), y: Number(match[2]), size: Number(match[3]) } : null;
  };

  it("is absent until a design asks for it", () => {
    expect(render()).not.toContain(qr);
    expect(plate(render())).toBeNull();
  });

  it("prints on a white plate, because a QR needs its quiet zone", () => {
    const svg = render({ qrHref: qr, qrPosition: "bottom-right" });
    expect(svg).toContain(qr);
    expect(plate(svg)).not.toBeNull();
  });

  it("goes to the corner it was given", () => {
    const corners = ["top-left", "top-right", "bottom-left", "bottom-right", "center"] as const;
    const spots = corners.map((qrPosition) => JSON.stringify(plate(render({ qrHref: qr, qrPosition }))));
    expect(new Set(spots).size).toBe(corners.length);
  });

  it("scales with the setting", () => {
    const small = plate(render({ qrHref: qr, qrScale: 0.5 }))!.size;
    const large = plate(render({ qrHref: qr, qrScale: 2 }))!.size;
    expect(large).toBeGreaterThan(small);
  });

  // Both are placed by corner, so an admin can aim them at the same one.
  // Stacking them invisibly would be the worst outcome.
  it("steps aside when the logo already has that corner", () => {
    const clash = plate(render({ qrHref: qr, qrPosition: "bottom-right", logoPosition: "bottom-right" }))!;
    const clear = plate(render({ qrHref: qr, qrPosition: "bottom-right", logoPosition: "header" }))!;
    expect(clash.x).not.toBe(clear.x);
  });

  it("stays inside the poster wherever it is put, at any scale", () => {
    for (const qrPosition of ["top-left", "top-right", "bottom-left", "bottom-right", "center"]) {
      for (const qrScale of [0.5, 1, 2]) {
        const box = plate(render({ qrHref: qr, qrPosition, qrScale }))!;
        expect(box.x, `${qrPosition}@${qrScale}`).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.size).toBeLessThanOrEqual(1080);
        expect(box.y + box.size).toBeLessThanOrEqual(1350);
      }
    }
  });
});

// The QR is only useful if it points where it claims to. Regenerating the
// expected code and comparing bytes proves the content, which eyeballing a
// picture of a QR cannot.
describe("businessQrDataUrl", () => {
  const opts = {
    margin: 1,
    width: 640,
    errorCorrectionLevel: "M" as const,
    color: { dark: "#000000ff", light: "#ffffffff" },
  };

  it("encodes the shop's own Markkito page", async () => {
    clearQrCache();
    const expected = await QRCode.toDataURL(`${env.CLIENT_ORIGIN}/business/spice-route-kitchen`, opts);
    await expect(businessQrDataUrl("spice-route-kitchen")).resolves.toBe(expected);
  });

  it("is a different code for a different shop", async () => {
    clearQrCache();
    const [a, b] = await Promise.all([businessQrDataUrl("shop-one"), businessQrDataUrl("shop-two")]);
    expect(a).not.toBe(b);
  });

  // A listing with no slug has no page to point at; a QR to a 404 is worse
  // than no QR.
  it("returns nothing when there is no page to link to", async () => {
    await expect(businessQrDataUrl(null)).resolves.toBeNull();
    await expect(businessQrDataUrl("")).resolves.toBeNull();
  });
});

// The prompt is the single description of what a poster carries, so the QR is
// switched on by naming it there rather than by a checkbox that could
// disagree with the words beside it.
describe("promptWantsQr", () => {
  it("sees @qr anywhere in the prompt", () => {
    expect(promptWantsQr("Diwali poster for @business_name. Add @qr bottom right.")).toBe(true);
    expect(promptWantsQr("@qr")).toBe(true);
    expect(promptWantsQr("{{qr}}")).toBe(true);
  });

  it("leaves a poster without one alone", () => {
    expect(promptWantsQr("Diwali poster for @business_name, phone @phone")).toBe(false);
    expect(promptWantsQr("")).toBe(false);
    expect(promptWantsQr(null)).toBe(false);
  });

  // "@qrcode" is a different token, and an email is not a token at all.
  // @qrcode and @QR_CODE@ are what designers actually write in artwork, so
  // both are the QR. A word that merely begins with "qr" is not, and neither
  // is the "qr" in front of an @ in an address.
  it("accepts the spellings a designer writes, and nothing else", () => {
    expect(promptWantsQr("use @qrcode please")).toBe(true);
    expect(promptWantsQr("slot marked @QR_CODE@")).toBe(true);
    expect(promptWantsQr("mail qr@example.com")).toBe(false);
    expect(promptWantsQr("@qrious about it")).toBe(false);
  });

  // Two addresses in a row must not have the span between them read as a
  // token just because it is bracketed by @ signs.
  it("does not read a token out of adjacent email addresses", () => {
    expect(fillPlaceholders("write to a@qr@b about it", subject)).toBe("write to a@qr@b about it");
  });

  it("resolves to the address the code points at", () => {
    expect(fillPlaceholders("Add a QR to @qr", subject)).toBe(
      "Add a QR to http://localhost:5173/business/spice-route-kitchen",
    );
  });
});

// The prompt describes the poster, so it is where the QR's corner is decided
// too — a picker beside it would only be a second opinion on one question.
describe("qrCornerFromPrompt", () => {
  it("reads the corner the prompt asks for", () => {
    expect(qrCornerFromPrompt("Leave the bottom right clear for @qr")).toBe("bottom-right");
    expect(qrCornerFromPrompt("@qr in the top left please")).toBe("top-left");
    expect(qrCornerFromPrompt("Put @qr bottom-left")).toBe("bottom-left");
    expect(qrCornerFromPrompt("@qr top-right")).toBe("top-right");
    expect(qrCornerFromPrompt("A big @qr in the centre")).toBe("center");
  });

  it("takes the words people actually write", () => {
    expect(qrCornerFromPrompt("@qr in the upper right")).toBe("top-right");
    expect(qrCornerFromPrompt("@qr lower left")).toBe("bottom-left");
    expect(qrCornerFromPrompt("@qr in the middle")).toBe("center");
    expect(qrCornerFromPrompt("@qr in the center")).toBe("center");
  });

  // "Logo top left, QR bottom right" means what a reader thinks it means.
  it("picks the corner nearest the token when a prompt names two", () => {
    expect(qrCornerFromPrompt("Logo in the top left, @qr in the bottom right")).toBe("bottom-right");
    expect(qrCornerFromPrompt("@qr top left, and the logo bottom right")).toBe("top-left");
  });

  it("falls back to the bottom right when the prompt does not say", () => {
    expect(qrCornerFromPrompt("Diwali poster for @business_name with @qr")).toBe("bottom-right");
    expect(qrCornerFromPrompt("")).toBe("bottom-right");
    expect(qrCornerFromPrompt(null)).toBe("bottom-right");
  });

  // A corner named with no @qr at all still parses, so the same helper can
  // answer "where would it go" before the token is typed.
  it("reads a corner even without the token", () => {
    expect(qrCornerFromPrompt("keep the top right clear")).toBe("top-right");
  });
});

// Sentences are read in clauses, and the QR's corner is whichever one sits in
// the same clause as the token. Raw proximity gets this wrong: in "Logo in the
// top left, @qr in the bottom right" the comma is nearer than the words after
// it, so distance alone hands the QR the logo's corner.
describe("qrCornerFromPrompt — clauses", () => {
  it.each([
    ["Logo in the top left, @qr in the bottom right", "bottom-right"],
    ["@qr top left, and the logo bottom right", "top-left"],
    ["Diyas bottom left. Put @qr in the top right.", "top-right"],
    ["Keep the centre clear; @qr goes bottom left", "bottom-left"],
  ])("%s → %s", (prompt, corner) => {
    expect(qrCornerFromPrompt(prompt)).toBe(corner);
  });

  // A corner named in a different clause is still better than ignoring it.
  it("uses a corner from elsewhere when the token's own clause names none", () => {
    expect(qrCornerFromPrompt("Leave the top right empty. Add @qr")).toBe("top-right");
  });
});

// The image engine is the same shape as the WhatsApp transport and the
// copywriter: a safe default that always works, and an opt-in upgrade. A shop
// that clicks "make my poster" must get a poster either way, so every path
// through here has to return an image.
describe("poster image engine", () => {
  const composited = { svg: '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', width: 1080, height: 1350 };
  const input = { template: null, prompt: "Diwali poster for Spice Route Kitchen", composited };

  const withEnv = async <T>(patch: Partial<typeof env>, run: () => Promise<T>): Promise<T> => {
    const before = { ...env };
    Object.assign(env, patch);
    try {
      return await run();
    } finally {
      Object.assign(env, before);
    }
  };

  it("composites locally by default, and says so", async () => {
    const result = await withEnv({ POSTER_IMAGE_ENGINE: "local" }, () => generatePosterImage(input));

    expect(result.engine).toBe("local");
    expect(result.note).toBeUndefined();
    expect(result).toMatchObject({ width: 1080, height: 1350 });
    expect(result.image.startsWith("data:image/svg+xml;base64,")).toBe(true);
  });

  // The data URI has to carry the poster itself — the frontend draws it onto a
  // canvas to export a PNG, so a link or a placeholder would be useless.
  it("returns the composited poster, not a reference to it", async () => {
    const result = await withEnv({ POSTER_IMAGE_ENGINE: "local" }, () => generatePosterImage(input));
    const decoded = Buffer.from(result.image.split(",")[1], "base64").toString();

    expect(decoded).toBe(composited.svg);
  });

  it("is not configured for the image model without a key", () => {
    expect(env.POSTER_IMAGE_ENGINE).toBe("local");
    expect(openAiConfigured()).toBe(false);
  });

  it("needs both the engine and the key before it counts as configured", async () => {
    await withEnv({ POSTER_IMAGE_ENGINE: "openai", OPENAI_API_KEY: "" }, async () => {
      expect(openAiConfigured()).toBe(false);
    });
    await withEnv({ POSTER_IMAGE_ENGINE: "local", OPENAI_API_KEY: "sk-test" }, async () => {
      expect(openAiConfigured()).toBe(false);
    });
    await withEnv({ POSTER_IMAGE_ENGINE: "openai", OPENAI_API_KEY: "sk-test" }, async () => {
      expect(openAiConfigured()).toBe(true);
    });
  });

  // Asking for the image model without a key is a deployment mistake, not a
  // reason to hand the shop an error page.
  it("composites and explains when the key is missing", async () => {
    const result = await withEnv({ POSTER_IMAGE_ENGINE: "openai", OPENAI_API_KEY: "" }, () =>
      generatePosterImage(input),
    );

    expect(result.engine).toBe("local");
    expect(result.note).toMatch(/OPENAI_API_KEY/);
    expect(result.image.startsWith("data:image/svg+xml;base64,")).toBe(true);
  });

  // Every way the image call can go wrong lands in one catch — here it is a
  // design with no template to edit, which never reaches the network. A key
  // the API rejects or a model that returns nothing ends the same way: the
  // shop still gets its poster, with a line saying why it is the local one.
  it("composites and explains when the image call fails", async () => {
    const result = await withEnv({ POSTER_IMAGE_ENGINE: "openai", OPENAI_API_KEY: "sk-not-a-real-key" }, () =>
      generatePosterImage({ ...input, template: null }),
    );

    expect(result.engine).toBe("local");
    expect(result.note).toMatch(/composited instead/);
    expect(result.image.startsWith("data:image/svg+xml;base64,")).toBe(true);
  });
});

// A shop's copy is stored so reopening a poster is instant, but "stored" must
// not mean "frozen": if the admin replaces the artwork or rewrites the prompt,
// every shop that already opened it would otherwise keep the withdrawn design.
describe("a stored copy is stale once the design changes", () => {
  const at = (iso: string) => new Date(iso);

  // The rule generateForOwner applies, stated once so the test can bite.
  const isCurrent = (generatedAt: Date | null, designUpdatedAt: Date) =>
    generatedAt != null && generatedAt >= designUpdatedAt;

  it("reuses a copy made after the last edit", () => {
    expect(isCurrent(at("2026-07-29T12:00:00Z"), at("2026-07-29T11:00:00Z"))).toBe(true);
  });

  it("remakes a copy made before the last edit", () => {
    expect(isCurrent(at("2026-07-29T11:00:00Z"), at("2026-07-29T12:00:00Z"))).toBe(false);
  });

  // Rows predating the image cache carry a null generatedAt with a download
  // count — those have no image at all and must not be treated as current.
  it("remakes when there is no copy on the row", () => {
    expect(isCurrent(null, at("2026-07-29T12:00:00Z"))).toBe(false);
  });

  it("reuses a copy made in the same instant as the edit", () => {
    const now = at("2026-07-29T12:00:00Z");
    expect(isCurrent(now, now)).toBe(true);
  });
});

// A designer's artwork is finished work. Fitting it to a preset frame crops
// whatever does not fit, and what sits at the edge — a logo box, a phone
// number — is exactly what a shop notices missing. So the frame is read from
// the file, and these are the bytes it has to read it out of.
describe("imageDimensions", () => {
  // Encoders write real headers; hand-written bytes only prove the parser
  // agrees with whoever wrote the test.
  const png = (dataUrl: string) => Buffer.from(dataUrl.split(",")[1], "base64");

  it("reads a PNG written by a real encoder", async () => {
    const qr = await QRCode.toDataURL("https://markkito.test/business/spice-route-kitchen", { width: 640, margin: 1 });
    expect(imageDimensions(png(qr))).toEqual({ width: 640, height: 640 });
  });

  it("reads a GIF header", () => {
    // GIF87a, 1080 x 1350 little-endian.
    const buffer = Buffer.alloc(16);
    buffer.write("GIF87a", 0, "ascii");
    buffer.writeUInt16LE(1080, 6);
    buffer.writeUInt16LE(1350, 8);
    expect(imageDimensions(buffer)).toEqual({ width: 1080, height: 1350 });
  });

  it("walks past JPEG metadata to the frame header", () => {
    // Two metadata segments of different lengths ahead of the SOF0, which is
    // the case a fixed offset gets wrong.
    const parts: Buffer[] = [Buffer.from([0xff, 0xd8])];
    for (const size of [18, 132]) {
      const segment = Buffer.alloc(2 + size);
      segment.writeUInt8(0xff, 0);
      segment.writeUInt8(0xe1, 1);
      const body = Buffer.alloc(size);
      body.writeUInt16BE(size, 0);
      parts.push(segment.subarray(0, 2), body);
    }
    const sof = Buffer.alloc(11);
    sof.writeUInt8(0xff, 0);
    sof.writeUInt8(0xc0, 1);
    sof.writeUInt16BE(9, 2);
    sof.writeUInt8(8, 4);
    sof.writeUInt16BE(1920, 5); // height
    sof.writeUInt16BE(1080, 7); // width
    parts.push(sof);

    expect(imageDimensions(Buffer.concat(parts))).toEqual({ width: 1080, height: 1920 });
  });

  it("returns null rather than a guess for bytes it cannot measure", () => {
    expect(imageDimensions(Buffer.from("not an image at all"))).toBeNull();
    expect(imageDimensions(Buffer.alloc(4))).toBeNull();
    // A PNG signature with a zeroed IHDR: a canvas of 0x0 is unusable.
    const empty = Buffer.alloc(24);
    Buffer.from("89504e470d0a1a0a", "hex").copy(empty, 0);
    empty.write("IHDR", 12, "ascii");
    expect(imageDimensions(empty)).toBeNull();
  });

  it("reads the size out of a stored data URI without decoding all of it", async () => {
    const qr = await QRCode.toDataURL("https://markkito.test/a", { width: 320, margin: 1 });
    expect(dataUriDimensions(qr)).toEqual({ width: 320, height: 320 });
    expect(dataUriDimensions(null)).toBeNull();
    expect(dataUriDimensions("https://example.com/a.png")).toBeNull();
  });
});

describe("posterFrame", () => {
  it("keeps the artwork's own shape", () => {
    expect(posterFrame("PORTRAIT", { width: 1080, height: 1920 })).toEqual({ width: 1080, height: 1920 });
    expect(posterFrame("PORTRAIT", { width: 2480, height: 3508 })).toEqual({ width: 1414, height: 2000 });
  });

  it("falls back to the preset when there is no artwork to measure", () => {
    expect(posterFrame("SQUARE", null)).toEqual(POSTER_SIZES.SQUARE);
    expect(posterFrame("STORY", null)).toEqual(POSTER_SIZES.STORY);
  });

  // The frame is also the canvas the browser rasterises, so a print-resolution
  // template must not turn into a 50-megapixel export.
  it("scales an oversized template down without changing its proportions", () => {
    const frame = posterFrame("PORTRAIT", { width: 6000, height: 4000 });
    expect(Math.max(frame.width, frame.height)).toBe(2000);
    expect(frame.width / frame.height).toBeCloseTo(1.5, 2);
  });
});

// The bug this was written for: a 9:16 template rendered into the 4:5 preset
// lost a fifth of its width off both edges.
describe("artwork is not cropped into a preset", () => {
  it("renders at the artwork's ratio, not the preset's", () => {
    const story = { width: 1080, height: 1920 };
    const { width, height } = renderPosterSvg(
      {
        size: "PORTRAIT",
        dimensions: posterFrame("PORTRAIT", story),
        palette: PALETTES[0],
        copy: { headline: "", subheadline: "", ctaText: "", badgeText: "", footnote: "", headerText: "", footerText: "" },
        subject,
        logoHref: null,
        backgroundHref: "data:image/png;base64,AAAA",
      },
      "artwork",
    );

    expect({ width, height }).toEqual(story);
    expect(height / width).not.toBeCloseTo(POSTER_SIZES.PORTRAIT.height / POSTER_SIZES.PORTRAIT.width, 2);
  });
});

// An SVG is a document, not a picture. It is accepted because a template's
// slots can then be filled exactly — and only after everything executable has
// been taken out of it, because the result is served from our own origin.
describe("sanitizeSvg", () => {
  const wrap = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">${body}</svg>`;

  it("removes a script the file brought with it", () => {
    const { svg, removed } = sanitizeSvg(wrap(`<script>alert(1)</script><rect width="10" height="10"/>`));
    expect(svg).not.toMatch(/script/i);
    expect(svg).toMatch(/<rect/);
    expect(removed).toContain("<script>");
  });

  it("removes event handlers, including one on the root element", () => {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" onload="steal()" width="10" height="10">
      <rect onclick="x()" onmouseover="y()" width="5" height="5"/></svg>`;
    const { svg } = sanitizeSvg(source);
    expect(svg).not.toMatch(/onload|onclick|onmouseover/i);
    expect(svg).toMatch(/<rect/);
  });

  // A <foreignObject> is a hole in the SVG through which arbitrary HTML —
  // and therefore arbitrary script — reaches the page.
  it("removes foreignObject and the other element-shaped holes", () => {
    for (const tag of ["foreignObject", "iframe", "object", "embed"]) {
      const { svg } = sanitizeSvg(wrap(`<${tag}><b>x</b></${tag}>`));
      expect(svg.toLowerCase(), tag).not.toContain(tag.toLowerCase());
    }
  });

  // SMIL can rewrite an attribute after the sanitiser has approved it, which
  // makes an approved href a moving target.
  it("removes animation elements that could rewrite a checked attribute", () => {
    const { svg } = sanitizeSvg(wrap(`<image href="#a"><animate attributeName="href" to="javascript:x"/></image>`));
    expect(svg).not.toMatch(/animate/i);
  });

  it("keeps an embedded image but drops one that reaches off the page", () => {
    const inline = sanitizeSvg(wrap(`<image href="data:image/png;base64,AAAA" width="10" height="10"/>`));
    expect(inline.svg).toContain("data:image/png;base64,AAAA");

    const remote = sanitizeSvg(wrap(`<image href="https://tracker.example/pixel.png" width="10" height="10"/>`));
    expect(remote.svg).not.toContain("tracker.example");
  });

  it("strips javascript: wherever it is hiding", () => {
    const { svg } = sanitizeSvg(wrap(`<a href="javascript:alert(1)"><rect width="5" height="5"/></a>`));
    expect(svg).not.toMatch(/javascript:/i);
    expect(svg).toMatch(/<rect/);
  });

  it("strips external references out of CSS, in attributes and in style blocks", () => {
    const styled = sanitizeSvg(
      wrap(`<style>@import url(https://evil.example/x.css); .a{fill:url(https://evil.example/p.png)}</style>` +
        `<rect style="fill:url(https://evil.example/q.png)" width="5" height="5"/>`),
    );
    expect(styled.svg).not.toContain("evil.example");
    expect(styled.svg).not.toMatch(/@import/i);
  });

  it("refuses a file that is not an SVG at all", () => {
    expect(() => sanitizeSvg("<html><body>hi</body></html>")).toThrow();
    expect(() => sanitizeSvg("just some text")).toThrow();
  });

  it("reads the drawing's size from width and height, or the viewBox", () => {
    expect(svgDimensions(`<svg width="1080" height="1920"></svg>`)).toEqual({ width: 1080, height: 1920 });
    expect(svgDimensions(`<svg width="1080px" height="1350px"></svg>`)).toEqual({ width: 1080, height: 1350 });
    expect(svgDimensions(`<svg viewBox="0 0 595 842"></svg>`)).toEqual({ width: 595, height: 842 });
    expect(svgDimensions(`<svg></svg>`)).toBeNull();
  });
});

// The point of the whole exercise: the shop's details land in the boxes the
// designer drew for them, rather than under strips laid over the top.
describe("fillSvgTemplate", () => {
  const template = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
    <g><rect x="40" y="40" width="200" height="200" stroke-dasharray="8"/><text x="60" y="120" font-size="34">@LOGO@</text></g>
    <text x="600" y="90" font-size="48" fill="#0b3b8f">@CLINIC_NAME@</text>
    <text x="60" y="1800" font-size="40">Call @PHONE@ today</text>
    <text x="700" y="1700" font-size="30">@ADDRESS@</text>
    <g><rect x="820" y="1600" width="200" height="200" stroke-dasharray="8"/><text x="840" y="1700">@QR_CODE@</text></g>
  </svg>`;

  const filled = (options = { logoHref: "data:image/png;base64,LOGO", qrHref: "data:image/png;base64,QR" }) =>
    fillSvgTemplate(template, subject, options);

  it("finds every slot, under the names a designer writes", () => {
    expect(svgSlots(template).known.sort()).toEqual(["address", "business_name", "logo", "phone", "qr"]);
    expect(svgSlots(template).unknown).toEqual([]);
  });

  it("puts the shop's name where the designer put the slot", () => {
    const { svg } = filled();
    // Same element, same position, same type — only the words changed.
    expect(svg).toMatch(/<text x="600" y="90" font-size="48" fill="#0b3b8f">Spice Route Kitchen<\/text>/);
    expect(svg).not.toContain("@CLINIC_NAME@");
  });

  it("fills a token sitting inside a sentence", () => {
    expect(filled().svg).toContain("Call +91 98765 43210 today");
  });

  it("puts an image over the box the designer marked, without distorting it", () => {
    const { svg } = filled();
    expect(svg).toMatch(/<image[^>]*href="data:image\/png;base64,LOGO"[^>]*x="40"[^>]*y="40"[^>]*width="200"[^>]*height="200"/);
    expect(svg).toMatch(/href="data:image\/png;base64,QR"[^>]*x="820"[^>]*y="1600"/);
    // A stretched logo looks wrong; a stretched QR does not scan.
    expect(svg.match(/preserveAspectRatio="xMidYMid meet"/g)).toHaveLength(2);
  });

  // The dashed rectangle is a marker, not part of the design.
  it("removes the marker box it drew the image into", () => {
    expect(filled().svg).not.toMatch(/stroke-dasharray/);
  });

  // A solid rectangle is more likely the white plate a QR needs to scan.
  it("keeps a solid rectangle behind the slot", () => {
    const solid = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <g><rect x="10" y="10" width="50" height="50" fill="#ffffff"/><text x="12" y="30">@QR_CODE@</text></g></svg>`;
    const { svg } = fillSvgTemplate(solid, subject, { logoHref: null, qrHref: "data:image/png;base64,QR" });
    expect(svg).toMatch(/<rect[^>]*fill="#ffffff"/);
    expect(svg).toMatch(/<image/);
  });

  it("reports what it filled and what it could not", () => {
    const result = fillSvgTemplate(template, subject, { logoHref: null, qrHref: null });
    expect(result.filled).toContain("business_name");
    expect(result.unfilled).toEqual(expect.arrayContaining(["logo", "qr"]));
  });

  // A shop with no logo must not ship a poster reading "@LOGO@".
  it("leaves a gap rather than the label when there is nothing to fill it with", () => {
    const { svg } = fillSvgTemplate(template, subject, { logoHref: null, qrHref: null });
    expect(svg).not.toContain("@LOGO@");
    expect(svg).not.toContain("@QR_CODE@");
  });

  it("leaves the artwork's own words alone", () => {
    expect(filled().svg).toContain('font-size="40"');
    expect(filled().svg).toMatch(/width="1080" height="1920"/);
  });
});

// A guide box is instruction to the designer, not part of the poster.
describe("an image slot with nothing to put in it", () => {
  const template = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <g><rect x="10" y="10" width="100" height="100" stroke-dasharray="6" fill="none" stroke="#fff"/>
       <text x="12" y="60" fill="#ffffff">@LOGO@</text></g>
    <g><rect x="200" y="200" width="100" height="100" stroke-dasharray="6" fill="none"/>
       <text x="202" y="250">@QR_CODE@</text></g>
  </svg>`;

  const empty = () => fillSvgTemplate(template, subject, { logoHref: null, qrHref: null });

  it("takes the guide box away with the label", () => {
    expect(empty().svg).not.toMatch(/stroke-dasharray/);
    expect(empty().svg).not.toContain("@LOGO@");
  });

  // The dashboard tells a shop with no logo that its initials will be used,
  // so the poster has to actually do that.
  it("puts the shop's initials in the logo slot", () => {
    const { svg } = empty();
    expect(svg).toContain(">SR<");
    // In the colour the designer chose for that spot — a fixed dark or light
    // would vanish on half the templates.
    expect(svg).toMatch(/<text[^>]*fill="#ffffff"[^>]*>SR</);
    expect(svg).toMatch(/<circle[^>]*cx="60"[^>]*cy="60"/);
  });

  // A monogram where a code should be does not scan; it just misleads.
  it("leaves the QR slot empty rather than inventing something", () => {
    const { svg } = empty();
    expect(svg).not.toContain("@QR_CODE@");
    expect((svg.match(/<circle/g) ?? []).length).toBe(1);
  });
});

// A designer will write a slot our vocabulary has never heard of. What must
// not happen is @DOCTOR_NAME@ printing across a hundred shops' posters.
describe("a slot nothing knows how to fill", () => {
  const template = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <text x="10" y="40">@CLINIC_NAME@</text>
    <text x="10" y="80">Ask for @DOCTOR_NAME@ today</text>
    <text x="10" y="120">@TAGLINE@</text>
  </svg>`;

  it("names it at upload, where it can still be fixed", () => {
    const slots = svgSlots(template);
    expect(slots.known).toContain("business_name");
    expect(slots.unknown.sort()).toEqual(["DOCTOR_NAME", "TAGLINE"]);
  });

  it("leaves a gap on the poster instead of the label", () => {
    const { svg, unfilled } = fillSvgTemplate(template, subject, { logoHref: null, qrHref: null });

    expect(svg).not.toMatch(/@[A-Z_]+@/);
    expect(svg).toContain("Spice Route Kitchen");
    // The words around it survive — only the token goes.
    expect(svg).toContain("Ask for today");
    expect(unfilled).toEqual(expect.arrayContaining(["doctor_name", "tagline"]));
  });
});

// The whole point of an SVG template: what comes out is the designer's file
// with the values in it. Nothing of ours is painted over the top.
describe("an SVG template gets no frame of ours", () => {
  const template = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">
    <rect width="600" height="800" fill="#ffffff"/>
    <text x="20" y="60" font-family="Georgia" font-size="44" fill="#123456">@SHOP_NAME@</text>
  </svg>`;

  it("adds nothing but the values", () => {
    const { svg } = fillSvgTemplate(template, subject, { logoHref: null, qrHref: null });

    // One rect — the designer's. No band, no strip, no plate of ours.
    expect((svg.match(/<rect/g) ?? []).length).toBe(1);
    expect(svg).not.toMatch(/linearGradient|logo-|band/);
    expect(svg).toMatch(/font-family="Georgia" font-size="44" fill="#123456">Spice Route Kitchen</);
    expect(svg).toMatch(/width="600" height="800"/);
  });
});
