/**
 * Geopolitics Agent (reports to the Macro Agent): wars, conflicts and sanctions in the news,
 * how tense each region is, whether crude, gold and the rupee are reacting, and which
 * Indian stocks that usually helps or hurts.
 *
 * Headlines: Google News (India edition), last 2 days, from neutral searches per region.
 * Each headline counts +2 for severe escalation (war, missile, airstrike…), +1 for milder
 * tension (warns, sanctions…), -1.5 for calming news (ceasefire, talks…); the average is
 * scaled by how much news there is. It shows the tone of the news, not a forecast.
 */
import { parseRss } from "./news";
import type { Analysis } from "./types";

export type GeoThemeId = "middleeast" | "russia" | "southasia" | "eastasia";
export type GeoLevel = "Calm" | "Watch" | "Elevated" | "High";

export interface GeoHeadline { title: string; source: string; url: string; date: string; tone: "escalation" | "calming" | "neutral" }
export interface GeoTheme {
  id: GeoThemeId;
  name: string;
  /** 0-100: how tense the news is. */
  score: number;
  trend: "Escalating" | "Easing" | "Steady";
  headlines: GeoHeadline[];
  /** What this usually means for Indian markets. */
  effects: string[];
}
export interface GeoExposure { symbol: string; effect: "Tailwind" | "Headwind"; points: number; reason: string; theme: GeoThemeId }
export interface GeoReport {
  level: GeoLevel;
  score: number;
  themes: GeoTheme[];
  /** 5-day moves of the markets wars usually move. */
  markets: { crudePct?: number; goldPct?: number; usdinrPct?: number };
  summary: string;
  exposures: GeoExposure[];
  checkedAt: string;
  sample: boolean;
}

const THEMES: Record<GeoThemeId, { name: string; query: string; match: RegExp; effects: string[] }> = {
  middleeast: {
    name: "Middle East & Gulf",
    query: 'Israel OR Iran OR Gaza OR Houthi OR "Red Sea" OR Hormuz OR Hezbollah',
    match: /israel|iran|gaza|hamas|hezbollah|houthi|red sea|hormuz|yemen|lebanon|syria|gulf/i,
    effects: ["Crude oil up on supply fears (India imports ~85% of its oil)", "Shipping costs up on Red Sea / Hormuz routes", "Gold up as a safe haven", "Rupee weaker"],
  },
  russia: {
    name: "Russia–Ukraine & Europe",
    query: "Russia Ukraine OR Kremlin OR NATO",
    match: /russia|ukrain|kremlin|putin|zelensk|nato|crimea|kyiv|moscow/i,
    effects: ["Crude and gas prices up", "Metals and fertiliser prices up", "Gold up", "European demand risk for exporters"],
  },
  southasia: {
    name: "India's borders",
    query: '"India Pakistan" OR LoC OR "India China border" OR Ladakh OR "Line of Actual Control"',
    match: /pakistan|\bloc\b|line of control|line of actual control|ladakh|arunachal|galwan|kashmir|border/i,
    effects: ["Indian stocks risk-off for a few sessions", "Defence orders and defence stocks up", "Rupee weaker"],
  },
  eastasia: {
    name: "China, Taiwan & trade wars",
    query: 'Taiwan China OR "South China Sea" OR "North Korea" OR "trade war" OR "export curbs"',
    match: /taiwan|south china sea|north korea|pyongyang|tariff|trade war|export curb|rare earth|sanction/i,
    effects: ["Electronics supply chains at risk (components from China)", "Global growth and IT-services demand risk", "Metal prices swing"],
  },
};

/** Severe escalation (counts double) and milder signs of tension. */
const SEVERE = /\b(war|wars|attack\w*|strike|strikes|airstrike\w*|air strike\w*|missile\w*|drone strike\w*|bomb\w*|invad\w*|invasion|kill\w*|dead|troops|shelling|offensive)\b/i;
const MILD = /\b(drone|drones|escalat\w*|mobili[sz]\w*|retaliat\w*|clash\w*|blockade|seiz\w*|sanction\w*|threat\w*|warn\w*|firing|hostil\w*|tension\w*|drill\w*|military)\b/i;
const ESCALATION = new RegExp(`${SEVERE.source}|${MILD.source}`, "i");
const CALMING = /\b(ceasefire|cease-fire|truce|peace|talks|deal|agreement|de-escalat\w*|calm\w*|withdraw\w*|eases?|easing|diplomac\w*|hostage release|accord)\b/i;

export function toneOf(title: string): GeoHeadline["tone"] {
  const esc = ESCALATION.test(title), calm = CALMING.test(title);
  return calm && !/\b(collaps\w*|break\w*|broke|violat\w*|fail\w*|ends|ended)\b/i.test(title) ? "calming" : esc ? "escalation" : "neutral";
}

/** Score a region from its headlines (exported for tests). */
export function scoreTheme(id: GeoThemeId, headlines: GeoHeadline[]): GeoTheme {
  const t = THEMES[id];
  const relevant = headlines.filter((h) => t.match.test(h.title));
  const esc = relevant.filter((h) => h.tone === "escalation").length;
  const calm = relevant.filter((h) => h.tone === "calming").length;
  // Each headline: severe +2, mild +1, calming -1.5, neutral 0; averaged, then scaled by how much news there is.
  const weight = (h: GeoHeadline) => (h.tone === "calming" ? -1.5 : h.tone === "escalation" ? (SEVERE.test(h.title) ? 2 : 1) : 0);
  const n = relevant.length;
  const intensity = n ? relevant.reduce((a, x) => a + weight(x), 0) / (2 * n) : 0;
  const volume = Math.min(1, n / 8);
  const score = Math.round(100 * Math.max(0, Math.min(1, intensity)) * (0.5 + 0.5 * volume));
  const trend = score >= 25 && esc > calm * 1.5 && esc >= 2 ? "Escalating" : calm > esc ? "Easing" : "Steady";
  return { id, name: t.name, score, trend, headlines: relevant.slice(0, 6), effects: t.effects };
}

export const levelOf = (score: number): GeoLevel => (score >= 75 ? "High" : score >= 50 ? "Elevated" : score >= 25 ? "Watch" : "Calm");

// Stocks these events usually move (NSE symbols).
const DEFENCE = ["HAL", "BEL", "BDL", "MAZDOCK", "COCHINSHIP", "GRSE", "DATAPATTNS", "BEML", "MTARTECH", "ASTRAMICRO", "PARAS", "SOLARINDS", "ZENTEC", "MIDHANI"];
const UPSTREAM_OIL = ["ONGC", "OIL"];
const OIL_USERS: Record<string, string> = {
  BPCL: "oil marketer", HINDPETRO: "oil marketer", IOC: "oil marketer", MRPL: "refiner", CHENNPETRO: "refiner",
  ASIANPAINT: "paints (crude-based inputs)", BERGEPAINT: "paints (crude-based inputs)", KANSAINER: "paints (crude-based inputs)", INDIGOPNTS: "paints (crude-based inputs)",
  INDIGO: "airline (jet fuel)", SPICEJET: "airline (jet fuel)",
  MRF: "tyres (crude-based rubber)", APOLLOTYRE: "tyres (crude-based rubber)", CEATLTD: "tyres (crude-based rubber)", JKTYRE: "tyres (crude-based rubber)", BALKRISIND: "tyres (crude-based rubber)",
};
const GOLD_LENDERS = ["MUTHOOTFIN", "MANAPPURAM"];
const SHIPPING = ["SCI", "GESHIP"];
const ELECTRONICS = ["DIXON", "KAYNES", "SYRMA", "AMBER", "PGEL"];

/** Which stocks in this run the current tensions usually help or hurt (at most ±3 each). */
export function geoExposures(themes: GeoTheme[], symbols: string[], markets: GeoReport["markets"]): GeoExposure[] {
  const have = new Set(symbols);
  const by = Object.fromEntries(themes.map((t) => [t.id, t])) as Record<GeoThemeId, GeoTheme | undefined>;
  // The market agrees when Brent is up 2%+ in 5 days: then the oil effects count in full.
  const crudeConfirms = (markets.crudePct ?? 0) >= 2;
  // Stock effects once a region is clearly tense (60+), or 45+ for oil regions when crude confirms it;
  // the full defence lift needs India's borders at 70+.
  const hot = (id: GeoThemeId) => {
    const sc = by[id]?.score ?? 0;
    return sc >= 60 || (sc >= 45 && crudeConfirms && (id === "middleeast" || id === "russia"));
  };
  const oilShock = hot("middleeast") || hot("russia");
  const oilTheme: GeoThemeId = (by.middleeast?.score ?? 0) >= (by.russia?.score ?? 0) ? "middleeast" : "russia";
  const out = new Map<string, GeoExposure>();
  const put = (symbol: string, points: number, reason: string, theme: GeoThemeId) => {
    if (!have.has(symbol)) return;
    const prev = out.get(symbol);
    const p = Math.max(-3, Math.min(3, (prev?.points ?? 0) + points));
    out.set(symbol, { symbol, points: p, effect: p >= 0 ? "Tailwind" : "Headwind", reason: prev ? `${prev.reason}; ${reason}` : reason, theme: prev?.theme ?? theme });
  };
  const anyHot = themes.filter((t) => hot(t.id)).sort((a, b) => b.score - a.score)[0];
  const border = (by.southasia?.score ?? 0) >= 70;
  if (anyHot) for (const s of DEFENCE) put(s, border ? 3 : 2, `Defence: conflicts lift defence spending (${border ? THEMES.southasia.name : anyHot.name})`, border ? "southasia" : anyHot.id);
  if (oilShock) {
    const k = crudeConfirms ? 1 : 0.5;
    for (const s of UPSTREAM_OIL) put(s, Math.round(2 * k) || 1, `Oil producer: gains if crude rises on ${THEMES[oilTheme].name} tension`, oilTheme);
    for (const [s, what] of Object.entries(OIL_USERS)) put(s, -(Math.round(2 * k) || 1), `${what[0].toUpperCase()}${what.slice(1)}: costs rise if crude rises on ${THEMES[oilTheme].name} tension`, oilTheme);
    for (const s of GOLD_LENDERS) put(s, 1, "Gold loans: a higher gold price lets them lend more", oilTheme);
  }
  if (hot("middleeast")) for (const s of SHIPPING) put(s, 1, "Shipping: freight rates rise when Red Sea / Hormuz routes are disrupted", "middleeast");
  if (hot("eastasia")) for (const s of ELECTRONICS) put(s, -1, "Electronics: component supply from China at risk", "eastasia");
  return [...out.values()].filter((e) => e.points !== 0).sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
}

const pct = (n?: number) => (n === undefined ? "" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`);

/** One paragraph: how tense it is, where, and whether crude, gold and the rupee agree. */
export function geoSummary(level: GeoLevel, themes: GeoTheme[], m: GeoReport["markets"]): string {
  const top = [...themes].sort((a, b) => b.score - a.score)[0];
  if (!top || top.score < 25) return "World news is calm for markets: no conflict is escalating enough to move Indian stocks.";
  const moves = [m.crudePct !== undefined ? `Brent ${pct(m.crudePct)}` : "", m.goldPct !== undefined ? `gold ${pct(m.goldPct)}` : "", m.usdinrPct !== undefined ? `USD/INR ${pct(m.usdinrPct)}` : ""].filter(Boolean).join(", ");
  const reacting = (m.crudePct ?? 0) >= 2 || (m.goldPct ?? 0) >= 2;
  const word = { Calm: "low", Watch: "worth watching", Elevated: "elevated", High: "high" }[level];
  return `Geopolitical risk is ${word}, mainly from ${top.name} (${top.trend.toLowerCase()}, ${top.headlines.length} headlines in 2 days).` +
    (moves ? ` Over 5 days: ${moves}, so markets ${reacting ? "are pricing in some of it" : "aren't reacting much yet"}.` : "");
}

async function search(q: string): Promise<GeoHeadline[]> {
  try {
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:2d`)}&hl=en-IN&gl=IN&ceid=IN:en`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const seen = new Set<string>();
    return parseRss(await res.text()).filter((a) => !seen.has(a.title) && seen.add(a.title)).slice(0, 15)
      .map((a) => ({ title: a.title.slice(0, 180), source: a.source, url: a.link, date: a.date, tone: toneOf(a.title) }));
  } catch { return []; }
}

const IDS = Object.keys(THEMES) as GeoThemeId[];
let cache: { at: number; themes: GeoTheme[] } | null = null;

/** Headlines and scores for each region (live: Google News, kept 20 minutes; demo: sample). */
export async function loadGeoThemes(demo: boolean): Promise<{ themes: GeoTheme[]; sample: boolean }> {
  if (demo) {
    const h = (title: string): GeoHeadline => ({ title, source: "Sample", url: "", date: new Date().toISOString(), tone: toneOf(title) });
    return {
      sample: true,
      themes: [
        scoreTheme("middleeast", [h("Sample: missile strike reported near Red Sea shipping lane"), h("Sample: Iran warns of retaliation after attack"), h("Sample: talks on Gaza ceasefire continue")]),
        scoreTheme("russia", [h("Sample: Russia and Ukraine trade drone attacks overnight")]),
        scoreTheme("southasia", []),
        scoreTheme("eastasia", [h("Sample: US announces new tariffs on Chinese electronics")]),
      ],
    };
  }
  if (cache && Date.now() - cache.at < 20 * 60_000) return { themes: cache.themes, sample: false };
  const lists = await Promise.all(IDS.map((id) => search(THEMES[id].query)));
  const themes = IDS.map((id, i) => scoreTheme(id, lists[i]));
  if (lists.some((l) => l.length)) cache = { at: Date.now(), themes };
  return { themes, sample: false };
}

const back5 = (s?: { close: number }[]) => (s && s.length > 6 ? (s[s.length - 1].close / s[s.length - 6].close - 1) * 100 : undefined);

/** The full report for a run: themes, level, market check and the stocks affected. */
export function geoReport(
  loaded: { themes: GeoTheme[]; sample: boolean },
  series: { gold?: { close: number }[]; crude?: { close: number }[]; usdinr?: { close: number }[] } | undefined,
  symbols: string[],
): GeoReport {
  const themes = [...loaded.themes].sort((a, b) => b.score - a.score);
  const scores = themes.map((t) => t.score);
  const score = scores.length ? Math.round(0.7 * Math.max(...scores) + 0.3 * (scores.reduce((a, b) => a + b, 0) / scores.length)) : 0;
  const level = levelOf(score);
  const markets = { crudePct: back5(series?.crude), goldPct: back5(series?.gold), usdinrPct: back5(series?.usdinr) };
  const r = (n?: number) => (n === undefined ? undefined : Math.round(n * 10) / 10);
  const m = { crudePct: r(markets.crudePct), goldPct: r(markets.goldPct), usdinrPct: r(markets.usdinrPct) };
  return { level, score, themes, markets: m, summary: geoSummary(level, themes, m), exposures: geoExposures(themes, symbols, m), checkedAt: new Date().toISOString(), sample: loaded.sample };
}

/** Add the Geopolitics Agent's points to the scores (±3 at most) with a note. */
export function applyGeo<T extends Analysis>(rows: T[], geo: GeoReport | null): T[] {
  if (!geo?.exposures.length) return rows;
  const by = new Map(geo.exposures.map((e) => [e.symbol, e]));
  return rows.map((r) => {
    const e = by.get(r.symbol);
    if (!e) return r;
    return { ...r, combined: Math.max(0, Math.min(100, Math.round((r.combined + e.points) * 10) / 10)), geo: e,
      notes: [...r.notes, `World events ${e.points > 0 ? "+" : ""}${e.points}: ${e.reason}`] };
  }).sort((a, b) => b.combined - a.combined);
}
