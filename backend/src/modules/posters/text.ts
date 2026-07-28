/**
 * SVG has no automatic line wrapping, so the renderer has to decide where the
 * breaks go before it writes the markup.
 *
 * Measuring text properly needs the font, which the server does not have. What
 * it has instead is the observation that a proportional sans at weight 700
 * averages about 0.56em per character, and lighter weights a little less. That
 * estimate is within a few percent for the Latin text these posters carry, and
 * the layouts leave enough side margin to absorb the error.
 */

const AVG_CHAR_EM = { 400: 0.5, 600: 0.54, 700: 0.56, 800: 0.58 } as const;

/** Capitals carry no descenders and few narrow letters, so a line set in
 *  uppercase runs about a fifth wider than the same words in sentence case. */
const UPPERCASE_FACTOR = 1.2;

export type FontWeight = keyof typeof AVG_CHAR_EM;

export interface FitOptions {
  /** Pixels available for a line of text. */
  maxWidth: number;
  /** Preferred size; shrunk (never grown) until the text fits. */
  fontSize: number;
  /** Hard cap on lines. Text that still will not fit is truncated with "…". */
  maxLines: number;
  weight?: FontWeight;
  /** Floor for shrinking, as a fraction of fontSize. */
  minScale?: number;
  /** Extra tracking, in pixels per character. Left out of the estimate, a
   *  letter-spaced line runs past the edge it was measured against. */
  letterSpacing?: number;
  /** The caller will render this text uppercase, so measure it that way. */
  uppercase?: boolean;
}

export interface FittedText {
  lines: string[];
  fontSize: number;
}

/** Estimated advance of one character, tracking included. */
export function charWidth(fontSize: number, weight: FontWeight, letterSpacing = 0, uppercase = false): number {
  return fontSize * AVG_CHAR_EM[weight] * (uppercase ? UPPERCASE_FACTOR : 1) + letterSpacing;
}

function charsPerLine(maxWidth: number, fontSize: number, weight: FontWeight, letterSpacing = 0, uppercase = false): number {
  return Math.max(1, Math.floor(maxWidth / charWidth(fontSize, weight, letterSpacing, uppercase)));
}

/** Greedy word wrap. A word longer than a line is hard-split rather than
 *  allowed to overflow the poster. */
function wrap(text: string, limit: number): string[] {
  const lines: string[] = [];
  let current = "";

  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (word.length > limit) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += limit) lines.push(word.slice(i, i + limit));
      current = lines.pop() ?? "";
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= limit) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Wraps text to the box, shrinking the type in 6% steps until it fits within
 * maxLines. Headlines a shop types are rarely the length the design assumed,
 * so a poster that silently reflows beats one that spills off the edge.
 */
export function fitText(text: string, options: FitOptions): FittedText {
  const weight = options.weight ?? 700;
  const floor = options.fontSize * (options.minScale ?? 0.55);
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return { lines: [], fontSize: options.fontSize };

  const tracking = options.letterSpacing ?? 0;
  const caps = options.uppercase ?? false;
  let fontSize = options.fontSize;
  let lines = wrap(clean, charsPerLine(options.maxWidth, fontSize, weight, tracking, caps));

  while (lines.length > options.maxLines && fontSize > floor) {
    fontSize = Math.max(floor, fontSize * 0.94);
    lines = wrap(clean, charsPerLine(options.maxWidth, fontSize, weight, tracking, caps));
  }

  if (lines.length > options.maxLines) {
    lines = lines.slice(0, options.maxLines);
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = `${last.slice(0, Math.max(1, last.length - 1)).trimEnd()}…`;
  }

  return { lines, fontSize };
}

/** Escapes the five characters that would otherwise break XML. */
export function escapeXml(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** The first letter of each of the first two words — the monogram shown when
 *  a business has no logo to inline. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}
