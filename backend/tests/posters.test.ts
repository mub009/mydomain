import { describe, expect, it } from "vitest";
import { PosterSize } from "@prisma/client";
import { escapeXml, fitText, initials } from "@/modules/posters/text";
import { displayPhone, fillPlaceholders, PosterSubject, unknownPlaceholders } from "@/modules/posters/placeholders";
import { POSTER_LAYOUTS, POSTER_SIZES, renderPosterSvg, resolveLayout } from "@/modules/posters/layouts";
import { PALETTES, resolvePalette } from "@/modules/posters/palettes";
import { offlineSuggestions } from "@/modules/posters/copywriter";

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
    expect(fillPlaceholders("{{business}} in {{city}} — call {{phone}}", subject)).toBe(
      "Spice Route Kitchen in Kozhikode — call +91 98765 43210",
    );
  });

  it("is forgiving about spacing and case", () => {
    expect(fillPlaceholders("{{ Business }}", subject)).toBe("Spice Route Kitchen");
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
        copy: { headline: "Now open", subheadline: "", ctaText: "", badgeText: "", footnote: "" },
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
