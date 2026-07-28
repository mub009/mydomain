import { z } from "zod";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { PLACEHOLDERS } from "./placeholders";

/**
 * Where the poster wording comes from.
 *
 * The admin describes what the poster is for — "Diwali greeting, warm tone,
 * 20% off" — and gets back finished headlines with `{{business}}`-style
 * placeholders already in place, ready to render for every shop.
 *
 * Two engines sit behind one interface, the same arrangement the WhatsApp
 * transport uses. "offline" is a phrase bank that needs no account and no
 * network; "claude" calls the Anthropic API. The offline one is the default,
 * so the Poster Studio is fully usable before anyone configures a key.
 */

export const TONES = ["warm", "bold", "premium", "playful"] as const;
export type Tone = (typeof TONES)[number];

export interface CopyBrief {
  /** What the poster is about: "Diwali", "monsoon sale", "new branch". */
  occasion?: string;
  tone: Tone;
  /** The kind of shop this design targets, when it is targeted at one. */
  category?: string;
  city?: string;
  /** The deal, if there is one: "20% off", "buy 1 get 1". */
  offer?: string;
  /** Anything else the admin wants said. */
  notes?: string;
  /** How many alternatives to return. */
  count: number;
}

export interface CopySuggestion {
  headline: string;
  subheadline: string;
  ctaText: string;
  badgeText: string;
  footnote: string;
}

export type CopyEngine = "offline" | "claude";

export interface SuggestionResult {
  engine: CopyEngine;
  suggestions: CopySuggestion[];
  /** Set when the requested engine could not be used and a fallback ran. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Offline phrase bank
// ---------------------------------------------------------------------------

const CTA_BY_TONE: Record<Tone, string[]> = {
  warm: ["Call us today", "Visit us today", "We'd love to see you"],
  bold: ["Call now", "Grab it now", "Book today"],
  premium: ["Reserve your slot", "Enquire now", "Book a consultation"],
  playful: ["Come say hi", "Ping us!", "Don't miss out"],
};

const FOOTNOTE_BY_TONE: Record<Tone, string> = {
  warm: "{{business}} · {{city}}",
  bold: "Limited period offer · {{city}}",
  premium: "{{business}} · {{address}}",
  playful: "Find us in {{city}} · {{phone}}",
};

const OFFER_HEADLINES = [
  "{{offer}} on everything",
  "Big savings at {{business}}",
  "{{offer}} — this week only",
  "Your favourites, now {{offer}}",
];

const OCCASION_HEADLINES = [
  "Happy {{occasion}} from {{business}}",
  "{{business}} wishes you a joyful {{occasion}}",
  "Celebrate {{occasion}} with us",
  "Warm {{occasion}} wishes to you and your family",
];

const BRAND_HEADLINES = [
  "{{business}}, right here in {{city}}",
  "Trusted {{category}} in {{city}}",
  "{{business}} — always close by",
  "Quality {{category}} you can count on",
];

const SUBHEADS = [
  "Call {{phone}} or drop in — we're at {{address}}.",
  "{{city}}'s neighbourhood favourite. Call {{phone}}.",
  "Rated {{rating}} by {{reviews}} happy customers. Call {{phone}}.",
  "Find us at {{address}}, {{city}}. Call {{phone}}.",
];

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Builds `count` distinct suggestions by rotating through the bank. Nothing
 * random: the same brief gives the same list, so a preview does not change
 * under the admin between one click and the next.
 */
export function offlineSuggestions(brief: CopyBrief): CopySuggestion[] {
  const occasion = brief.occasion?.trim();
  const offer = brief.offer?.trim();

  const pool = offer ? OFFER_HEADLINES : occasion ? OCCASION_HEADLINES : BRAND_HEADLINES;
  const ctas = CTA_BY_TONE[brief.tone];
  const out: CopySuggestion[] = [];

  for (let i = 0; i < Math.max(1, brief.count); i++) {
    const headline = pool[i % pool.length]
      .replace("{{occasion}}", titleCase(occasion ?? "the season"))
      .replace("{{offer}}", offer ?? "special prices")
      .replace("{{category}}", brief.category ?? "service");

    // Ratings only read well on a shop that has some; the caller strips a
    // subheadline whose placeholders resolve to nothing anyway.
    const subheadline = SUBHEADS[(i + (offer ? 1 : 0)) % SUBHEADS.length];

    out.push({
      headline,
      subheadline,
      ctaText: ctas[i % ctas.length],
      badgeText: offer ? offer.toUpperCase() : occasion ? titleCase(occasion) : "",
      footnote: FOOTNOTE_BY_TONE[brief.tone],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Claude
// ---------------------------------------------------------------------------

const suggestionSchema = z.object({
  headline: z.string().max(90),
  subheadline: z.string().max(160).default(""),
  ctaText: z.string().max(40).default(""),
  badgeText: z.string().max(30).default(""),
  footnote: z.string().max(90).default(""),
});

const responseSchema = z.object({ suggestions: z.array(suggestionSchema).min(1) });

// Mirrors the zod schema above; sent to the API so the reply is already the
// right shape rather than prose that has to be scraped.
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          headline: { type: "string" },
          subheadline: { type: "string" },
          ctaText: { type: "string" },
          badgeText: { type: "string" },
          footnote: { type: "string" },
        },
        required: ["headline", "subheadline", "ctaText", "badgeText", "footnote"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
} as const;

function systemPrompt(): string {
  const tokens = PLACEHOLDERS.map((p) => `{{${p.token}}} — ${p.label}`).join("\n");
  return [
    "You write copy for print-and-share posters used by small local businesses in India —",
    "shops, clinics, salons, restaurants, repair centres.",
    "",
    "One design is rendered for hundreds of different businesses, so never name a specific",
    "business, city or phone number. Use these placeholders instead; they are substituted",
    "per business at render time:",
    tokens,
    "",
    "Rules:",
    "- headline: at most 8 words. It is set very large, so short wins.",
    "- subheadline: one sentence, at most 20 words. Include {{phone}} — the point of the",
    "  poster is that people call.",
    "- ctaText: 2-4 words, imperative.",
    "- badgeText: at most 3 words for a corner flash, or an empty string when there is no offer.",
    "- footnote: a short credit line, or an empty string.",
    "- Plain sentence case. No emoji, no hashtags, no ALL CAPS, no exclamation pile-ups.",
    "- Do not invent discounts, guarantees, awards or claims that were not in the brief.",
    "- Every suggestion must be meaningfully different, not a reword of the last.",
  ].join("\n");
}

function userPrompt(brief: CopyBrief): string {
  const lines = [`Write ${brief.count} poster copy options.`, `Tone: ${brief.tone}.`];
  if (brief.occasion) lines.push(`Occasion: ${brief.occasion}.`);
  if (brief.offer) lines.push(`Offer to feature: ${brief.offer}.`);
  if (brief.category) lines.push(`These businesses are in the "${brief.category}" category.`);
  if (brief.city) lines.push(`They are all in ${brief.city}.`);
  if (brief.notes) lines.push(`Extra notes from the designer: ${brief.notes}`);
  return lines.join("\n");
}

async function claudeSuggestions(brief: CopyBrief): Promise<CopySuggestion[]> {
  // Imported lazily so an install without the SDK, or without a key, still
  // boots — the offline engine is the default and must not depend on it.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: env.POSTER_AI_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: systemPrompt(),
    messages: [{ role: "user", content: userPrompt(brief) }],
  });

  const text = message.content
    .filter((block): block is { type: "text"; text: string } & typeof block => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (!text.trim()) throw new Error("The model returned no text");

  const parsed = responseSchema.parse(JSON.parse(text));
  return parsed.suggestions.slice(0, brief.count);
}

// ---------------------------------------------------------------------------

/** True when the Claude engine is both selected and actually usable. */
export function claudeConfigured(): boolean {
  return env.POSTER_AI_PROVIDER === "claude" && env.ANTHROPIC_API_KEY.length > 0;
}

/**
 * Suggests poster wording. Falls back to the phrase bank whenever Claude is
 * not configured or the call fails, and says which engine actually ran — a
 * poster editor that silently returns nothing is worse than one that returns
 * something plain and tells you why.
 */
export async function suggestCopy(brief: CopyBrief): Promise<SuggestionResult> {
  if (env.POSTER_AI_PROVIDER !== "claude") {
    return { engine: "offline", suggestions: offlineSuggestions(brief) };
  }

  if (!env.ANTHROPIC_API_KEY) {
    return {
      engine: "offline",
      suggestions: offlineSuggestions(brief),
      note: "POSTER_AI_PROVIDER is claude but ANTHROPIC_API_KEY is not set — used the built-in phrase bank.",
    };
  }

  try {
    return { engine: "claude", suggestions: await claudeSuggestions(brief) };
  } catch (err) {
    logger.warn({ err }, "Poster copy generation fell back to the offline engine");
    const reason = err instanceof Error ? err.message : "unknown error";
    return {
      engine: "offline",
      suggestions: offlineSuggestions(brief),
      note: `Claude could not be reached (${reason}) — used the built-in phrase bank.`,
    };
  }
}
