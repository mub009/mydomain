import { describe, expect, it } from "vitest";
import { PosterSize } from "@prisma/client";
import { escapeXml, fitText, initials } from "@/modules/posters/text";
import { displayPhone, fillPlaceholders, PosterSubject, unknownPlaceholders } from "@/modules/posters/placeholders";
import { POSTER_LAYOUTS, POSTER_SIZES, renderPosterSvg, resolveLayout } from "@/modules/posters/layouts";
import { PALETTES, resolvePalette } from "@/modules/posters/palettes";
import { offlineBands, offlineSuggestions } from "@/modules/posters/copywriter";
import { MAX_ARTWORK_BYTES, readUploadedImage } from "@/modules/posters/upload";
import { inlineImage } from "@/modules/posters/assets";

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
    expect(() => readUploadedImage({ buffer: Buffer.from("<html>not an image</html>") })).toThrow(/not a PNG/i);
  });

  // An SVG is a document — it can carry script — and this file is about to be
  // embedded in a document the platform serves from its own origin.
  it("rejects SVG, however it is dressed up", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(() => readUploadedImage({ buffer: svg })).toThrow(/not a PNG/i);
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
