import { PosterSize } from "@prisma/client";
import { Palette, resolvePalette } from "./palettes";
import { escapeXml, fitText, FontWeight, initials } from "./text";
import { displayPhone, PosterSubject } from "./placeholders";

export interface PosterDimensions {
  width: number;
  height: number;
}

/** The three shapes a shop actually posts: feed square, taller feed post, and
 *  a full-screen status. */
export const POSTER_SIZES: Record<PosterSize, PosterDimensions & { label: string; hint: string }> = {
  SQUARE: { width: 1080, height: 1080, label: "Square", hint: "Feed post — Instagram, Facebook" },
  PORTRAIT: { width: 1080, height: 1350, label: "Portrait", hint: "Taller feed post, more room for text" },
  STORY: { width: 1080, height: 1920, label: "Story", hint: "WhatsApp status, Instagram story" },
};

export interface PosterCopy {
  headline: string;
  subheadline: string;
  ctaText: string;
  badgeText: string;
  footnote: string;
}

export interface RenderInput {
  size: PosterSize;
  palette: Palette;
  copy: PosterCopy;
  subject: PosterSubject;
  /** Data URI for the shop's logo, or null when it could not be inlined. */
  logoHref: string | null;
  /** Data URI for the design's background image, or null. */
  backgroundHref: string | null;
}

export interface PosterLayout {
  id: string;
  name: string;
  description: string;
  bestFor: string;
  render(input: RenderInput, dim: PosterDimensions): string;
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

interface TextBlockOptions {
  x: number;
  y: number;
  maxWidth: number;
  fontSize: number;
  maxLines: number;
  fill: string;
  weight?: FontWeight;
  anchor?: "start" | "middle" | "end";
  lineHeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
  opacity?: number;
}

interface DrawnText {
  svg: string;
  /** Baseline y of the last line — where the next block can start. */
  bottom: number;
}

interface PreparedText {
  /** True when there was nothing to draw. */
  empty: boolean;
  /**
   * Total visual height: top of the first line to the bottom of the last.
   * Measured from the top, not from the baseline — a stack summed from
   * baselines comes out one ascent short and overruns whatever is below it.
   */
  height: number;
  /** Distance from the top of the first line down to its baseline. */
  ascent: number;
  bottom(firstBaseline: number): number;
  render(firstBaseline: number): string;
}

const FONT_STACK = "'Trebuchet MS','Segoe UI',Verdana,'DejaVu Sans',sans-serif";

/**
 * Wraps and shrinks the text, then hands back something that can be measured
 * before it is placed.
 *
 * The measurement step is what keeps a centred design honest: a three-line
 * headline and a two-line subheadline together are much taller than the
 * one-line versions the layout was drawn against, and a layout that places
 * each block at a fixed fraction of the height will happily print the button
 * on top of the sentence above it.
 */
function prepareText(text: string, o: Omit<TextBlockOptions, "y">): PreparedText {
  const body = o.uppercase ? text.toUpperCase() : text;
  const weight = o.weight ?? 700;
  const { lines, fontSize } = fitText(body, {
    maxWidth: o.maxWidth,
    fontSize: o.fontSize,
    maxLines: o.maxLines,
    weight,
    letterSpacing: o.letterSpacing,
    uppercase: o.uppercase,
  });

  const lineHeight = (o.lineHeight ?? 1.15) * fontSize;
  const ascent = fontSize * 0.78;
  const height = lines.length === 0 ? 0 : ascent + lineHeight * (lines.length - 1) + fontSize * 0.22;

  return {
    empty: lines.length === 0,
    height,
    ascent: lines.length === 0 ? 0 : ascent,
    bottom: (y) => (lines.length === 0 ? y : y + lineHeight * (lines.length - 1)),
    render(y) {
      if (lines.length === 0) return "";
      const spacing = o.letterSpacing ? ` letter-spacing="${o.letterSpacing}"` : "";
      const opacity = o.opacity !== undefined ? ` opacity="${o.opacity}"` : "";
      const tspans = lines
        .map((line, i) => `<tspan x="${o.x}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
        .join("");
      return (
        `<text x="${o.x}" y="${y}" font-family="${FONT_STACK}" font-size="${fontSize.toFixed(1)}" ` +
        `font-weight="${weight}" fill="${o.fill}" text-anchor="${o.anchor ?? "start"}"${spacing}${opacity}>${tspans}</text>`
      );
    },
  };
}

/** Prepare-and-place in one step, for blocks whose position is already fixed. */
function textBlock(text: string, o: TextBlockOptions): DrawnText {
  const prepared = prepareText(text, o);
  return { svg: prepared.render(o.y), bottom: prepared.bottom(o.y) };
}

/** The shop's logo as a clipped circle, or its monogram when there is no
 *  usable image. Every layout puts one somewhere — it is the whole point. */
function logoMark(input: RenderInput, cx: number, cy: number, r: number, ring: string, fill: string, text: string): string {
  const id = `logo-${Math.round(cx)}-${Math.round(cy)}`;
  if (input.logoHref) {
    return (
      `<defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>` +
      `<circle cx="${cx}" cy="${cy}" r="${r + r * 0.06}" fill="${ring}"/>` +
      `<image href="${escapeXml(input.logoHref)}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" ` +
      `preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`
    );
  }
  const mono = initials(input.subject.name);
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${ring}" stroke-width="${r * 0.07}"/>` +
    `<text x="${cx}" y="${cy + r * 0.34}" font-family="${FONT_STACK}" font-size="${r * 0.95}" font-weight="800" ` +
    `fill="${text}" text-anchor="middle">${escapeXml(mono)}</text>`
  );
}

/** Square logo variant, for layouts with a rectilinear grid. */
function logoTile(input: RenderInput, x: number, y: number, s: number, bg: string, text: string): string {
  const id = `tile-${Math.round(x)}-${Math.round(y)}`;
  const radius = s * 0.16;
  if (input.logoHref) {
    return (
      `<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${radius}"/></clipPath></defs>` +
      `<image href="${escapeXml(input.logoHref)}" x="${x}" y="${y}" width="${s}" height="${s}" ` +
      `preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`
    );
  }
  return (
    `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${radius}" fill="${bg}"/>` +
    `<text x="${x + s / 2}" y="${y + s * 0.68}" font-family="${FONT_STACK}" font-size="${s * 0.46}" ` +
    `font-weight="800" fill="${text}" text-anchor="middle">${escapeXml(initials(input.subject.name))}</text>`
  );
}

const PHONE_GLYPH =
  "M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.24.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z";
const PIN_GLYPH =
  "M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7m0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5";

function icon(path: string, x: number, y: number, size: number, fill: string): string {
  const scale = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${scale.toFixed(4)})"><path d="${path}" fill="${fill}"/></g>`;
}

/**
 * Phone number and city, the two things a poster exists to communicate.
 *
 * This row cannot wrap, so it has to be measured against the width it is
 * given: a long city on a square poster ran straight off the right edge. The
 * type shrinks first, and the city is dropped before the number is — the
 * number is the point of the poster.
 */
function contactRow(
  input: RenderInput,
  x: number,
  y: number,
  size: number,
  fill: string,
  mutedFill: string,
  maxWidth: number,
): string {
  const phone = displayPhone(input.subject.phone);
  const city = input.subject.city;

  // Digits at weight 800 run wider than the 0.56em average the wrapper
  // assumes, and there is no wrapping here to absorb the error — a tight
  // estimate put the pin icon on top of the last digit.
  const measure = (s: number) => {
    const phoneWidth = phone.length * s * 0.62 + s * 1.5;
    const cityWidth = city ? s * 0.9 + s * 1.3 + city.length * s * 0.92 * 0.56 : 0;
    return { phoneWidth, total: phoneWidth + cityWidth };
  };

  let fontSize = size;
  let withCity = Boolean(city);
  while (withCity && measure(fontSize).total > maxWidth && fontSize > size * 0.78) {
    fontSize *= 0.96;
  }
  if (withCity && measure(fontSize).total > maxWidth) {
    withCity = false;
    fontSize = size;
  }
  while (measure(fontSize).phoneWidth > maxWidth && fontSize > size * 0.6) {
    fontSize *= 0.96;
  }

  const { phoneWidth } = measure(fontSize);
  const gap = fontSize * 0.9;

  return (
    icon(PHONE_GLYPH, x, y - fontSize * 0.82, fontSize, fill) +
    `<text x="${x + fontSize * 1.35}" y="${y}" font-family="${FONT_STACK}" font-size="${fontSize.toFixed(1)}" font-weight="800" fill="${fill}">${escapeXml(phone)}</text>` +
    (withCity
      ? icon(PIN_GLYPH, x + phoneWidth + gap, y - fontSize * 0.82, fontSize, mutedFill) +
        `<text x="${x + phoneWidth + gap + fontSize * 1.3}" y="${y}" font-family="${FONT_STACK}" font-size="${(fontSize * 0.92).toFixed(1)}" font-weight="600" fill="${mutedFill}">${escapeXml(city)}</text>`
      : "")
  );
}

/**
 * Wraps text into the tallest form that fits the vertical budget it is given,
 * dropping a line at a time. Returns an empty block when even one line will
 * not fit — better to lose the sentence than print it through the footer.
 */
function fitBlock(text: string, o: Omit<TextBlockOptions, "y">, budget: number): PreparedText {
  for (let lines = o.maxLines; lines >= 1; lines--) {
    const prepared = prepareText(text, { ...o, maxLines: lines });
    if (prepared.empty || prepared.height <= budget) return prepared;
  }
  return prepareText("", o);
}

/** Below this fraction of the intended spacing, a layout stops looking laid
 *  out and starts looking broken. */
const MIN_GAP_SCALE = 0.45;

interface StackSpacing {
  showCta: boolean;
  /** Fraction of each ideal gap that survived, 0–1. */
  gapScale: number;
  /** Total height of the placed stack, for centring. */
  stackHeight: number;
}

/**
 * Fits a text stack and its optional button into the room available.
 *
 * The gaps close first, but only so far: squeezing a button up against the
 * sentence above it looks worse than not having a button, so once the spacing
 * would fall below `MIN_GAP_SCALE` the button is dropped and the text gets
 * its breathing room back. The phone number is on the contact strip either
 * way, so nothing essential is lost.
 */
function spaceStack(
  room: number,
  textHeight: number,
  textGaps: number,
  ctaHeight: number,
  ctaGap: number,
): StackSpacing {
  const fit = (withCta: boolean) => {
    const gaps = textGaps + (withCta ? ctaGap : 0);
    const spare = room - textHeight - (withCta ? ctaHeight : 0);
    const gapScale = gaps > 0 ? Math.max(0, Math.min(1, spare / gaps)) : 1;
    return { gapScale, stackHeight: textHeight + (withCta ? ctaHeight : 0) + gaps * gapScale };
  };

  if (ctaHeight > 0) {
    const withCta = fit(true);
    if (withCta.gapScale >= MIN_GAP_SCALE) return { showCta: true, ...withCta };
  }
  return { showCta: false, ...fit(false) };
}

/** Full-bleed background: the design's image when it has one (behind a scrim
 *  so the type stays readable), otherwise a two-tone gradient. */
function backdrop(input: RenderInput, dim: PosterDimensions, scrim: number, gradientId: string): string {
  const p = input.palette;
  const base =
    `<defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0.35" y2="1">` +
    `<stop offset="0" stop-color="${p.bgAlt}"/><stop offset="1" stop-color="${p.bg}"/></linearGradient></defs>` +
    `<rect width="${dim.width}" height="${dim.height}" fill="url(#${gradientId})"/>`;

  if (!input.backgroundHref) return base;

  return (
    base +
    `<image href="${escapeXml(input.backgroundHref)}" x="0" y="0" width="${dim.width}" height="${dim.height}" ` +
    `preserveAspectRatio="xMidYMid slice"/>` +
    `<rect width="${dim.width}" height="${dim.height}" fill="${p.bg}" opacity="${scrim}"/>`
  );
}

/** The corner flash ("30% OFF"). Skipped silently when the design has none. */
function badge(input: RenderInput, cx: number, cy: number, r: number): string {
  const label = input.copy.badgeText.trim();
  if (!label) return "";
  const p = input.palette;
  const { lines, fontSize } = fitText(label, { maxWidth: r * 1.7, fontSize: r * 0.42, maxLines: 2, weight: 800 });
  const tspans = lines
    .map((line, i) => `<tspan x="${cx}" dy="${i === 0 ? 0 : fontSize * 1.05}">${escapeXml(line)}</tspan>`)
    .join("");
  const firstY = cy + fontSize * 0.34 - ((lines.length - 1) * fontSize * 1.05) / 2;
  return (
    `<g transform="rotate(-12 ${cx} ${cy})"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.accent}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.9}" fill="none" stroke="${p.onAccent}" stroke-width="${r * 0.035}" opacity="0.55"/>` +
    `<text x="${cx}" y="${firstY}" font-family="${FONT_STACK}" font-size="${fontSize.toFixed(1)}" font-weight="800" ` +
    `fill="${p.onAccent}" text-anchor="middle">${tspans}</text></g>`
  );
}

/**
 * Rounded call-to-action pill, sized to its own label.
 *
 * `y` is where the layout would like it; `maxBottom` is where the footer
 * starts. A long headline pushes everything below it down, so without the
 * clamp the pill slides under the contact bar and gets cut in half.
 */
function ctaPill(input: RenderInput, cx: number, y: number, fontSize: number, maxBottom: number): string {
  const label = input.copy.ctaText.trim();
  if (!label) return "";
  const p = input.palette;
  const width = Math.min(label.length * fontSize * 0.6 + fontSize * 2.6, 900);
  const height = fontSize * 2.3;
  y = Math.min(y, maxBottom - height);
  return (
    `<rect x="${cx - width / 2}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${p.accent}"/>` +
    `<text x="${cx}" y="${y + height * 0.66}" font-family="${FONT_STACK}" font-size="${fontSize}" font-weight="800" ` +
    `fill="${p.onAccent}" text-anchor="middle" letter-spacing="${fontSize * 0.04}">${escapeXml(label.toUpperCase())}</text>`
  );
}

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

const spotlight: PosterLayout = {
  id: "spotlight",
  name: "Spotlight",
  description: "Logo on top, one big centred message, contact strip along the bottom.",
  bestFor: "Announcements and general branding",
  render(input, dim) {
    const p = input.palette;
    const { width: W, height: H } = dim;
    const M = W * 0.09;
    const inner = W - M * 2;

    const logoR = W * 0.105;
    const logoCy = H * 0.155;

    const name = textBlock(input.subject.name, {
      x: W / 2,
      y: logoCy + logoR * 1.75,
      maxWidth: inner,
      fontSize: W * 0.05,
      maxLines: 2,
      fill: p.ink,
      weight: 800,
      anchor: "middle",
      uppercase: true,
      letterSpacing: W * 0.004,
    });

    const barH = H * 0.115;
    const barY = H - barH;

    // Measure the middle stack, then centre it in the band between the
    // business name and the contact bar, so a long headline pushes the
    // subheadline and button around rather than through them.
    const headline = prepareText(input.copy.headline, {
      x: W / 2,
      maxWidth: inner,
      fontSize: W * 0.115,
      maxLines: 3,
      fill: p.ink,
      weight: 800,
      anchor: "middle",
      lineHeight: 1.08,
    });

    const ctaSize = W * 0.042;
    const idealGap = W * 0.07;

    const bandTop = name.bottom + W * 0.1;
    const bandBottom = barY - W * 0.06;
    const room = bandBottom - bandTop;

    // A three-line headline over a three-line subheadline over a button does
    // not fit a square, so the space is given up in order of least value: the
    // subheadline sheds lines, then the gaps close, and the button goes last —
    // the poster still works without it, since the number is on the bar below.
    const sub = fitBlock(
      input.copy.subheadline,
      {
        x: W / 2,
        maxWidth: inner * 0.94,
        fontSize: W * 0.042,
        maxLines: 3,
        fill: p.muted,
        weight: 600,
        anchor: "middle",
        lineHeight: 1.3,
      },
      room - headline.height - idealGap * 0.5,
    );

    const textHeight = headline.height + (sub.empty ? 0 : sub.height);
    const { showCta, gapScale, stackHeight } = spaceStack(
      room,
      textHeight,
      sub.empty ? 0 : idealGap,
      input.copy.ctaText.trim() ? ctaSize * 2.3 : 0,
      idealGap * 0.9,
    );
    const gap = idealGap * gapScale;

    const stackTop = Math.max(bandTop, bandTop + (room - stackHeight) / 2);
    const headlineY = stackTop + headline.ascent;
    const subY = headline.bottom(headlineY) + gap + sub.ascent;
    const ctaY = (sub.empty ? headline.bottom(headlineY) : sub.bottom(subY)) + gap * 0.9;

    return [
      backdrop(input, dim, 0.62, "spotlight-bg"),
      `<rect x="${M * 0.55}" y="${M * 0.55}" width="${W - M * 1.1}" height="${H - M * 1.1 - barH * 0.4}" rx="${W * 0.03}" fill="none" stroke="${p.accent}" stroke-width="3" opacity="0.35"/>`,
      logoMark(input, W / 2, logoCy, logoR, p.accent, p.bgAlt, p.ink),
      name.svg,
      `<rect x="${W / 2 - W * 0.06}" y="${name.bottom + W * 0.035}" width="${W * 0.12}" height="6" rx="3" fill="${p.accent}"/>`,
      headline.render(headlineY),
      sub.render(subY),
      showCta ? ctaPill(input, W / 2, ctaY, ctaSize, bandBottom) : "",
      // Top corner, clear of the centred name and headline below it.
      badge(input, W - M - W * 0.02, H * 0.115, W * 0.105),
      `<rect x="0" y="${barY}" width="${W}" height="${barH}" fill="${p.accent}"/>`,
      contactRow(input, M, barY + barH * 0.62, W * 0.045, p.onAccent, p.onAccent, inner),
    ].join("");
  },
};

const offer: PosterLayout = {
  id: "offer",
  name: "Offer",
  description: "A hard-edged colour block with a discount flash — built to shout a deal.",
  bestFor: "Discounts, sales and limited-time offers",
  render(input, dim) {
    const p = input.palette;
    const { width: W, height: H } = dim;
    const M = W * 0.085;
    const inner = W - M * 2;
    const footerH = H * 0.17;

    const eyebrow = textBlock(input.subject.category || "Special offer", {
      x: M,
      y: H * 0.235,
      maxWidth: inner * 0.7,
      fontSize: W * 0.032,
      maxLines: 1,
      fill: p.accent,
      weight: 800,
      uppercase: true,
      letterSpacing: W * 0.006,
    });

    const headline = prepareText(input.copy.headline, {
      x: M,
      maxWidth: inner * 0.96,
      fontSize: W * 0.125,
      maxLines: 4,
      fill: p.ink,
      weight: 800,
      lineHeight: 1.03,
      uppercase: true,
    });

    const tile = W * 0.14;
    const footerY = H - footerH;

    // Top-anchored, but lifted if a four-line headline would otherwise push
    // the button down into the footer. When even that is not enough the
    // subheadline sheds lines and the button is dropped, in that order.
    const ctaSize = W * 0.038;
    const ruleGap = W * 0.028;
    const idealGap = W * 0.075;

    const bandTop = eyebrow.bottom + W * 0.08;
    const bandBottom = footerY - W * 0.06;
    const room = bandBottom - bandTop;

    const sub = fitBlock(
      input.copy.subheadline,
      {
        x: M,
        maxWidth: inner * 0.88,
        fontSize: W * 0.04,
        maxLines: 3,
        fill: p.muted,
        weight: 600,
        lineHeight: 1.35,
      },
      room - headline.height - ruleGap - idealGap * 0.7,
    );

    const textHeight = headline.height + ruleGap + (sub.empty ? 0 : idealGap * 0.7 + sub.height);
    const { showCta, gapScale, stackHeight } = spaceStack(
      room,
      textHeight,
      0,
      input.copy.ctaText.trim() ? ctaSize * 2.3 : 0,
      idealGap,
    );
    const gap = idealGap * gapScale;

    const stackTop = Math.max(bandTop, Math.min(H * 0.36, bandBottom - stackHeight));
    const headlineY = stackTop + headline.ascent;
    const ruleY = headline.bottom(headlineY) + ruleGap;
    const subY = ruleY + idealGap * 0.7 + sub.ascent;
    const ctaY = (sub.empty ? ruleY : sub.bottom(subY)) + gap;

    return [
      `<rect width="${W}" height="${H}" fill="${p.bg}"/>`,
      input.backgroundHref
        ? `<image href="${escapeXml(input.backgroundHref)}" x="0" y="0" width="${W}" height="${H * 0.18}" preserveAspectRatio="xMidYMid slice"/>` +
          `<rect width="${W}" height="${H * 0.18}" fill="${p.accent}" opacity="0.7"/>`
        : `<path d="M0 0 H${W} V${H * 0.13} L0 ${H * 0.18} Z" fill="${p.accent}"/>`,
      `<path d="M0 ${H * 0.155} H${W} V${H * 0.175} L0 ${H * 0.205} Z" fill="${p.accent}" opacity="0.25"/>`,
      eyebrow.svg,
      headline.render(headlineY),
      `<rect x="${M}" y="${ruleY}" width="${W * 0.17}" height="8" rx="4" fill="${p.accent}"/>`,
      sub.render(subY),
      showCta ? ctaPill(input, M + Math.min(inner * 0.5, W * 0.34), ctaY, ctaSize, bandBottom) : "",
      badge(input, W - M - W * 0.13, H * 0.155, W * 0.135),
      `<rect x="0" y="${footerY}" width="${W}" height="${footerH}" fill="${p.dark ? p.bgAlt : p.ink}"/>`,
      logoTile(input, M, footerY + (footerH - tile) / 2, tile, p.accent, p.onAccent),
      textBlock(input.subject.name, {
        x: M + tile + W * 0.04,
        y: footerY + footerH * 0.42,
        maxWidth: inner - tile - W * 0.05,
        fontSize: W * 0.045,
        maxLines: 1,
        fill: p.dark ? p.ink : p.bg,
        weight: 800,
      }).svg,
      contactRow(
        input,
        M + tile + W * 0.04,
        footerY + footerH * 0.72,
        W * 0.04,
        p.accent,
        p.dark ? p.muted : p.bgAlt,
        inner - tile - W * 0.04,
      ),
    ].join("");
  },
};

const festival: PosterLayout = {
  id: "festival",
  name: "Festival",
  description: "Ornamental frame and centred type, for Diwali, Onam, Eid and season greetings.",
  bestFor: "Festival and seasonal greetings",
  render(input, dim) {
    const p = input.palette;
    const { width: W, height: H } = dim;
    const M = W * 0.1;
    const inner = W - M * 2;
    const arc = W * 0.26;

    const logoR = W * 0.085;
    const badgeR = W * 0.105;
    const hasBadge = input.copy.badgeText.trim().length > 0;

    const name = textBlock(input.subject.name, {
      x: W / 2,
      y: H * 0.165 + logoR * 1.9,
      // The badge sits in the top corner, so the name gives up the width it
      // occupies rather than running underneath it.
      maxWidth: hasBadge ? inner - badgeR * 2 : inner,
      fontSize: W * 0.042,
      maxLines: 2,
      fill: p.ink,
      weight: 700,
      anchor: "middle",
      uppercase: true,
      letterSpacing: W * 0.005,
    });

    const greeting = prepareText(input.copy.headline, {
      x: W / 2,
      maxWidth: inner,
      fontSize: W * 0.115,
      maxLines: 3,
      fill: p.accent,
      weight: 800,
      anchor: "middle",
      lineHeight: 1.1,
    });

    // Centre greeting + subheadline + divider between the name and the
    // contact line, so short and long greetings both sit balanced; when the
    // three together do not fit, the subheadline sheds lines first.
    const idealGap = W * 0.075;
    const dividerHeight = W * 0.036;
    const bandTop = name.bottom + W * 0.1;
    const bandBottom = H - M * 0.9 - W * 0.08;
    const room = bandBottom - bandTop;

    const sub = fitBlock(
      input.copy.subheadline,
      {
        x: W / 2,
        maxWidth: inner * 0.9,
        fontSize: W * 0.04,
        maxLines: 3,
        fill: p.dark ? p.muted : p.ink,
        weight: 600,
        anchor: "middle",
        lineHeight: 1.35,
      },
      room - greeting.height - idealGap - dividerHeight - idealGap * 0.8,
    );

    const fixedHeight = greeting.height + (sub.empty ? 0 : sub.height) + dividerHeight;
    const wantedGaps = (sub.empty ? 0 : idealGap) + idealGap * 0.8;
    const gapScale = Math.max(0, Math.min(1, (room - fixedHeight) / wantedGaps));
    const gap = idealGap * gapScale;

    const stackHeight = fixedHeight + wantedGaps * gapScale;
    const stackTop = Math.max(bandTop, bandTop + (room - stackHeight) / 2);
    const greetingY = stackTop + greeting.ascent;
    const subY = greeting.bottom(greetingY) + gap + sub.ascent;
    const dividerY = (sub.empty ? greeting.bottom(greetingY) : sub.bottom(subY)) + gap * 0.8;

    return [
      backdrop(input, dim, 0.72, "festival-bg"),
      // Corner ornaments — quarter arcs, so the frame reads as decorative
      // without needing a raster texture.
      `<path d="M0 ${arc} A ${arc} ${arc} 0 0 1 ${arc} 0" fill="none" stroke="${p.accent}" stroke-width="${W * 0.012}" opacity="0.7"/>`,
      `<path d="M${W - arc} 0 A ${arc} ${arc} 0 0 1 ${W} ${arc}" fill="none" stroke="${p.accent}" stroke-width="${W * 0.012}" opacity="0.7"/>`,
      `<path d="M0 ${H - arc} A ${arc} ${arc} 0 0 0 ${arc} ${H}" fill="none" stroke="${p.accent}" stroke-width="${W * 0.012}" opacity="0.7"/>`,
      `<path d="M${W - arc} ${H} A ${arc} ${arc} 0 0 0 ${W} ${H - arc}" fill="none" stroke="${p.accent}" stroke-width="${W * 0.012}" opacity="0.7"/>`,
      `<rect x="${M * 0.5}" y="${M * 0.5}" width="${W - M}" height="${H - M}" rx="${W * 0.02}" fill="none" stroke="${p.accent}" stroke-width="2" opacity="0.45"/>`,
      logoMark(input, W / 2, H * 0.165, logoR, p.accent, p.bgAlt, p.ink),
      name.svg,
      greeting.render(greetingY),
      sub.render(subY),
      `<g opacity="0.8"><rect x="${W / 2 - W * 0.16}" y="${dividerY}" width="${W * 0.32}" height="3" fill="${p.accent}"/>` +
        `<circle cx="${W / 2}" cy="${dividerY + 1.5}" r="${W * 0.018}" fill="${p.accent}"/></g>`,
      badge(input, W - M - W * 0.01, H * 0.12, badgeR),
      contactRow(input, M, H - M * 0.9, W * 0.042, p.accent, p.muted, inner),
      textBlock(input.copy.footnote, {
        x: W / 2,
        y: H - M * 0.32,
        maxWidth: inner,
        fontSize: W * 0.026,
        maxLines: 1,
        fill: p.muted,
        weight: 600,
        anchor: "middle",
      }).svg,
    ].join("");
  },
};

const minimal: PosterLayout = {
  id: "minimal",
  name: "Minimal",
  description: "Left-aligned type, generous whitespace and a single accent rule.",
  bestFor: "Clinics, consultants and premium brands",
  render(input, dim) {
    const p = input.palette;
    const { width: W, height: H } = dim;
    const M = W * 0.095;
    const inner = W - M * 2;
    const tile = W * 0.11;
    const badgeR = W * 0.095;
    const hasBadge = input.copy.badgeText.trim().length > 0;
    const headWidth = inner - tile - W * 0.04 - (hasBadge ? badgeR * 2.1 : 0);

    const headline = prepareText(input.copy.headline, {
      x: M,
      maxWidth: inner * 0.95,
      fontSize: W * 0.1,
      maxLines: 4,
      fill: p.ink,
      weight: 700,
      lineHeight: 1.12,
    });

    const ctaSize = W * 0.038;
    const ruleGap = W * 0.032;
    const idealGap = W * 0.07;

    const bandTop = H * 0.09 + tile + W * 0.09;
    const bandBottom = H - W * 0.2 - W * 0.05;
    const room = bandBottom - bandTop;

    const sub = fitBlock(
      input.copy.subheadline,
      {
        x: M,
        maxWidth: inner * 0.82,
        fontSize: W * 0.036,
        maxLines: 4,
        fill: p.muted,
        weight: 400,
        lineHeight: 1.45,
      },
      room - headline.height - ruleGap - idealGap * 0.6,
    );

    const textHeight = headline.height + ruleGap + (sub.empty ? 0 : idealGap * 0.6 + sub.height);
    const { showCta, gapScale, stackHeight } = spaceStack(
      room,
      textHeight,
      0,
      input.copy.ctaText.trim() ? ctaSize * 1.4 : 0,
      idealGap,
    );
    const cta = showCta ? input.copy.ctaText.trim() : "";
    const gap = idealGap * gapScale;

    const stackTop = Math.max(bandTop, Math.min(H * 0.4, bandBottom - stackHeight));
    const headlineY = stackTop + headline.ascent;
    const ruleY = headline.bottom(headlineY) + ruleGap;
    const subY = ruleY + idealGap * 0.6 + sub.ascent;
    const ctaY = (sub.empty ? ruleY : sub.bottom(subY)) + gap;

    return [
      `<rect width="${W}" height="${H}" fill="${p.bg}"/>`,
      input.backgroundHref
        ? `<image href="${escapeXml(input.backgroundHref)}" x="0" y="${H * 0.72}" width="${W}" height="${H * 0.28}" preserveAspectRatio="xMidYMid slice" opacity="0.18"/>`
        : "",
      `<rect x="0" y="0" width="${W}" height="${H * 0.012}" fill="${p.accent}"/>`,
      logoTile(input, M, H * 0.09, tile, p.accent, p.onAccent),
      textBlock(input.subject.name, {
        x: M + tile + W * 0.035,
        y: H * 0.09 + tile * 0.45,
        maxWidth: headWidth,
        fontSize: W * 0.038,
        maxLines: 1,
        fill: p.ink,
        weight: 700,
      }).svg,
      textBlock(input.subject.category, {
        x: M + tile + W * 0.035,
        y: H * 0.09 + tile * 0.82,
        maxWidth: headWidth,
        fontSize: W * 0.026,
        maxLines: 1,
        fill: p.muted,
        weight: 600,
        uppercase: true,
        letterSpacing: W * 0.004,
      }).svg,
      headline.render(headlineY),
      `<rect x="${M}" y="${ruleY}" width="${W * 0.13}" height="5" fill="${p.accent}"/>`,
      sub.render(subY),
      cta
        ? textBlock(cta, {
            x: M,
            y: ctaY,
            maxWidth: inner * 0.8,
            fontSize: ctaSize,
            maxLines: 1,
            fill: p.accent,
            weight: 800,
            uppercase: true,
            letterSpacing: W * 0.004,
          }).svg +
          `<rect x="${M}" y="${ctaY + ctaSize * 0.35}" width="${Math.min(cta.length * ctaSize * 0.62, inner * 0.8)}" height="3" fill="${p.accent}" opacity="0.5"/>`
        : "",
      badge(input, W - M - W * 0.01, H * 0.135, badgeR),
      `<rect x="${M}" y="${H - W * 0.2}" width="${inner}" height="2" fill="${p.ink}" opacity="0.12"/>`,
      contactRow(input, M, H - W * 0.115, W * 0.042, p.ink, p.muted, inner),
      textBlock(input.copy.footnote, {
        x: M,
        y: H - W * 0.055,
        maxWidth: inner,
        fontSize: W * 0.024,
        maxLines: 1,
        fill: p.muted,
        weight: 400,
      }).svg,
    ].join("");
  },
};

export const POSTER_LAYOUTS: PosterLayout[] = [spotlight, offer, festival, minimal];
export const DEFAULT_LAYOUT_ID = POSTER_LAYOUTS[0].id;

export function resolveLayout(id?: string | null): PosterLayout {
  return POSTER_LAYOUTS.find((l) => l.id === id) ?? POSTER_LAYOUTS[0];
}

/** The picker shown in the admin editor. */
export function layoutChoices() {
  return POSTER_LAYOUTS.map(({ id, name, description, bestFor }) => ({ id, name, description, bestFor }));
}

export function sizeChoices() {
  return (Object.keys(POSTER_SIZES) as PosterSize[]).map((id) => ({ id, ...POSTER_SIZES[id] }));
}

/** Assembles the finished document. Nothing external is referenced — images
 *  are already data URIs — so the file can be saved, mailed, or drawn onto a
 *  canvas and exported as PNG without a network round trip. */
export function renderPosterSvg(input: RenderInput, layoutId: string): { svg: string; width: number; height: number } {
  const dim = POSTER_SIZES[input.size] ?? POSTER_SIZES.PORTRAIT;
  const layout = resolveLayout(layoutId);
  const body = layout.render(input, dim);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${dim.width}" height="${dim.height}" viewBox="0 0 ${dim.width} ${dim.height}">` +
    `<title>${escapeXml(input.subject.name)} — ${escapeXml(input.copy.headline)}</title>` +
    body +
    `</svg>`;

  return { svg, width: dim.width, height: dim.height };
}

export { resolvePalette };
