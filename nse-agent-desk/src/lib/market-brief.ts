/**
 * Market brief: did the Nifty, Sensex, Bank Nifty, gold and silver go up or
 * down, and why? Every reason comes from data: global markets, sector moves,
 * NSE breadth and India VIX, crude oil and the rupee, the dollar and US bond
 * yields (for gold), plus the day's headlines. Also a day-by-day history.
 */
import { yahooProvider } from "./market/yahoo";
import { SECTOR_INDEX } from "./sectors";
import { parseRss, sentimentOf } from "./news";
import type { Bar } from "./types";
import { nseMarketMood, nseMcpEnabled, type NseMood } from "./nse-mcp/client";

export type AssetId = "nifty" | "sensex" | "banknifty" | "gold" | "silver";
export interface Headline { title: string; source: string; url: string; date: string; tone: "positive" | "negative" | "neutral" }
export interface AssetBrief {
  id: AssetId; name: string; unit: string;
  price: number; change: number; changePct: number; date: string;
  /** Plain-language reasons, biggest first. */
  reasons: string[];
  /** What worked against the move. */
  against: string[];
  headline: string;
  news: Headline[];
}
export interface DayRow { date: string; nifty?: number; banknifty?: number; gold?: number; usdinr?: number; crude?: number; why: string }
export interface MarketBrief { at: string; session: string; assets: AssetBrief[]; days: DayRow[]; context: { name: string; changePct: number; note: string }[] }

const SYMBOLS = {
  nifty: "^NSEI", sensex: "^BSESN", banknifty: "^NSEBANK", vix: "^INDIAVIX",
  goldUsd: "GC=F", silverUsd: "SI=F", usdinr: "INR=X", crude: "BZ=F", dxy: "DX-Y.NYB", us10y: "^TNX",
  spx: "^GSPC", nasdaq: "^IXIC", nikkei: "^N225", hangseng: "^HSI", kospi: "^KS11",
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const word = (n: number, up = "rose", down = "fell") => (n >= 0 ? up : down);

type Series = Map<string, number>; // date -> close
const toSeries = (bars: Bar[]): Series => new Map(bars.map((b) => [b.date.slice(0, 10), b.close]));
/** Change on `date` against the previous available close. */
function dayChange(s: Series | undefined, date?: string): number | undefined {
  if (!s || s.size < 2) return undefined;
  const dates = [...s.keys()].sort();
  const i = date ? dates.lastIndexOf(dates.filter((d) => d <= date).pop() ?? "") : dates.length - 1;
  if (i < 1) return undefined;
  const a = s.get(dates[i - 1])!, b = s.get(dates[i])!;
  return a ? ((b - a) / a) * 100 : undefined;
}
const last = (s?: Series) => (s && s.size ? s.get([...s.keys()].sort().pop()!)! : undefined);
const lastDate = (s?: Series) => (s && s.size ? [...s.keys()].sort().pop()! : undefined);

/** Gold and silver in rupees: ₹ per 10 g and ₹ per kg (no import duty or GST). */
function inRupees(usd: Series | undefined, fx: Series | undefined, gramsPerUnit: number): Series | undefined {
  if (!usd || !fx) return undefined;
  const out: Series = new Map();
  let lastFx: number | undefined;
  for (const d of [...new Set([...usd.keys(), ...fx.keys()])].sort()) {
    lastFx = fx.get(d) ?? lastFx;
    const u = usd.get(d);
    if (u !== undefined && lastFx) out.set(d, (u * lastFx / 31.1035) * gramsPerUnit);
  }
  return out;
}

async function headlines(q: string): Promise<Headline[]> {
  try {
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:1d`)}&hl=en-IN&gl=IN&ceid=IN:en`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const seen = new Set<string>();
    return parseRss(await res.text()).filter((a) => !seen.has(a.title) && seen.add(a.title)).slice(0, 5)
      .map((a) => ({ title: a.title.slice(0, 170), source: a.source, url: a.link, date: a.date, tone: sentimentOf(a.title) }));
  } catch { return []; }
}

/** A reason and which way it pushes the asset (+1 up, -1 down). */
export interface Reason { text: string; effect: 1 | -1; size: number }
const sign = (n: number): 1 | -1 => (n >= 0 ? 1 : -1);

/** Split reasons into what drove the move and what worked against it, biggest first. */
export function arrange(changePct: number, rs: Reason[]): { reasons: string[]; against: string[] } {
  const dir = sign(changePct);
  const by = (a: Reason, b: Reason) => b.size - a.size;
  return { reasons: rs.filter((x) => x.effect === dir).sort(by).slice(0, 4).map((x) => x.text), against: rs.filter((x) => x.effect !== dir).sort(by).slice(0, 2).map((x) => x.text) };
}

/** Index reasons: global cues (Asia the same day, Wall Street the session before), sectors, breadth, VIX, crude and the rupee. */
export function indexReasons(o: {
  changePct: number; asia: { name: string; pct: number }[]; us?: { spx?: number; nasdaq?: number; date?: string };
  sectors: { name: string; changePct: number }[]; mood?: NseMood | null; vixPct?: number; crudePct?: number; inrPct?: number; banks?: boolean;
}): Reason[] {
  const out: Reason[] = [];
  const up = o.changePct >= 0;
  const asia = o.asia.length ? o.asia.reduce((s, x) => s + x.pct, 0) / o.asia.length : undefined;
  if (asia !== undefined && Math.abs(asia) >= 0.4) out.push({ effect: sign(asia), size: Math.abs(asia), text: `Asian markets ${word(asia)} the same day (${o.asia.map((x) => `${x.name} ${pct(x.pct)}`).join(", ")})` });
  const us = o.us?.spx !== undefined ? (o.us.spx + (o.us.nasdaq ?? o.us.spx)) / 2 : undefined;
  if (us !== undefined && Math.abs(us) >= 0.4) out.push({ effect: sign(us), size: Math.abs(us) * 0.9, text: `Wall Street ${word(us)} in its previous session${o.us?.date ? ` (${o.us.date})` : ""}: S&P 500 ${pct(o.us!.spx!)}${o.us?.nasdaq !== undefined ? `, Nasdaq ${pct(o.us.nasdaq)}` : ""}` });
  const sorted = [...o.sectors].filter((s) => Number.isFinite(s.changePct)).sort((a, b) => (up ? b.changePct - a.changePct : a.changePct - b.changePct));
  const movers = sorted.filter((s) => (up ? s.changePct > 0.3 : s.changePct < -0.3)).slice(0, 3);
  if (!o.banks && movers.length) out.push({ effect: up ? 1 : -1, size: Math.abs(movers[0].changePct) * 1.3, text: `${movers.map((s) => `${s.name} ${pct(s.changePct)}`).join(", ")} ${up ? "led the gains" : "dragged the most"}` });
  const against = sorted.slice().reverse().find((s) => (up ? s.changePct < -0.5 : s.changePct > 0.5));
  if (!o.banks && against) out.push({ effect: up ? -1 : 1, size: Math.abs(against.changePct) * 0.5, text: `${against.name} went the other way (${pct(against.changePct)})` });
  const b = o.mood?.stock_breadth;
  if (b && b.up + b.down > 0 && (b.up_pct >= 58 || b.up_pct <= 42)) out.push({ effect: b.up_pct >= 50 ? 1 : -1, size: 0.8, text: `${b.up.toLocaleString("en-IN")} stocks rose and ${b.down.toLocaleString("en-IN")} fell on NSE (${b.up_pct.toFixed(0)}% up): ${b.up_pct >= 58 ? "broad buying" : "broad selling"}` });
  if (o.vixPct !== undefined && Math.abs(o.vixPct) >= 3) out.push({ effect: o.vixPct > 0 ? -1 : 1, size: Math.abs(o.vixPct) / 6, text: `India VIX ${word(o.vixPct)} ${Math.abs(o.vixPct).toFixed(1)}%: traders were ${o.vixPct > 0 ? "buying protection (more nervous)" : "calmer"}` });
  if (o.crudePct !== undefined && Math.abs(o.crudePct) >= 1.5) out.push({ effect: o.crudePct > 0 ? -1 : 1, size: Math.abs(o.crudePct) / 3, text: `Brent crude ${word(o.crudePct)} ${Math.abs(o.crudePct).toFixed(1)}%: ${o.crudePct > 0 ? "a cost for India, which imports most of its oil" : "a relief for India's oil import bill"}` });
  if (o.inrPct !== undefined && Math.abs(o.inrPct) >= 0.25) out.push({ effect: o.inrPct > 0 ? -1 : 1, size: Math.abs(o.inrPct) * 2, text: `The rupee ${o.inrPct > 0 ? "weakened" : "strengthened"} (USD/INR ${pct(o.inrPct)}), ${o.inrPct > 0 ? "often a sign of foreign investors selling" : "often a sign of foreign money coming in"}` });
  if (o.banks) {
    const fin = o.sectors.find((s) => s.name === "Nifty Financial Services");
    if (fin && Math.abs(fin.changePct) >= 0.3) out.push({ effect: sign(fin.changePct), size: Math.abs(fin.changePct), text: `Financial stocks overall ${word(fin.changePct, "gained", "lost")} ${Math.abs(fin.changePct).toFixed(2)}%: lenders and insurers moved together` });
  }
  return out;
}

/** Gold / silver reasons: the dollar, US yields, the rupee, and how stocks did (safe-haven demand). */
export function metalReasons(o: { name: string; changePct: number; usdPct?: number; dxyPct?: number; yieldChange?: number; inrPct?: number; stocksPct?: number }): Reason[] {
  const out: Reason[] = [];
  if (o.usdPct !== undefined) out.push({ effect: sign(o.usdPct), size: Math.abs(o.usdPct), text: `International ${o.name.toLowerCase()} ${word(o.usdPct)} ${Math.abs(o.usdPct).toFixed(2)}% in dollars` });
  if (o.dxyPct !== undefined && Math.abs(o.dxyPct) >= 0.15) out.push({ effect: o.dxyPct > 0 ? -1 : 1, size: Math.abs(o.dxyPct) * 2, text: `The US dollar ${o.dxyPct > 0 ? "strengthened" : "weakened"} (dollar index ${pct(o.dxyPct)}): that makes ${o.name.toLowerCase()} ${o.dxyPct > 0 ? "dearer for other buyers, so it usually falls" : "cheaper for other buyers, so it usually rises"}` });
  if (o.yieldChange !== undefined && Math.abs(o.yieldChange) >= 0.03) out.push({ effect: o.yieldChange > 0 ? -1 : 1, size: Math.abs(o.yieldChange) * 15, text: `US 10-year bond yields ${o.yieldChange > 0 ? "rose" : "fell"} ${Math.abs(o.yieldChange).toFixed(2)} points: ${o.yieldChange > 0 ? "bonds pay more, so non-interest-paying gold is less attractive" : "bonds pay less, which favours gold"}` });
  if (o.inrPct !== undefined && Math.abs(o.inrPct) >= 0.1) out.push({ effect: o.inrPct > 0 ? 1 : -1, size: Math.abs(o.inrPct) * 1.5, text: `The rupee ${o.inrPct > 0 ? "weakened" : "strengthened"} (USD/INR ${pct(o.inrPct)}), so the rupee price moved ${o.inrPct > 0 ? "up" : "down"} by about that much on top` });
  if (o.stocksPct !== undefined && Math.abs(o.stocksPct) >= 0.8) out.push({ effect: o.stocksPct < 0 ? 1 : -1, size: Math.abs(o.stocksPct) / 2, text: `Stock markets ${word(o.stocksPct)} (S&P 500 ${pct(o.stocksPct)}): ${o.stocksPct < 0 ? "investors moved to safe havens like gold" : "investors preferred riskier assets"}` });
  return out;
}

const headlineOf = (name: string, changePct: number, reasons: string[]) =>
  `${name} ${changePct >= 0 ? "rose" : "fell"} ${Math.abs(changePct).toFixed(2)}%${reasons[0] ? `, mainly because ${/^(The|Asian|International|Financial) /.test(reasons[0]) ? reasons[0].charAt(0).toLowerCase() + reasons[0].slice(1) : reasons[0]}` : ""}.`;

let cache: { at: number; brief: MarketBrief } | null = null;

export async function marketBrief(): Promise<MarketBrief> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.brief;
  const sectorSyms = { ...Object.fromEntries(Object.values(SECTOR_INDEX).map((s) => [s.name, s.symbol])), "Nifty Financial Services": "NIFTY_FIN_SERVICE.NS" };
  const all = { ...SYMBOLS, ...sectorSyms } as Record<string, string>;
  const loaded = await Promise.all(Object.entries(all).map(async ([k, sym]) => {
    try { return [k, toSeries((await yahooProvider.getDailyBars(sym)).slice(-40))] as const; } catch { return [k, undefined] as const; }
  }));
  const s = Object.fromEntries(loaded) as Record<string, Series | undefined>;
  const [, mood, newsIdx, newsBank, newsGold, newsSilver] = await Promise.all([
    Promise.resolve(null),
    nseMcpEnabled() ? nseMarketMood().catch(() => null) : Promise.resolve(null),
    headlines("Sensex Nifty today"), headlines("Bank Nifty today"), headlines("gold price today India"), headlines("silver price today India"),
  ]);
  const goldInr = inRupees(s.goldUsd, s.usdinr, 10), silverInr = inRupees(s.silverUsd, s.usdinr, 1000);
  const session = lastDate(s.nifty) ?? new Date().toISOString().slice(0, 10);
  const ch = (k: string, date = session) => dayChange(s[k], date);
  const sectors = Object.keys(sectorSyms).map((name) => ({ name, changePct: ch(name) ?? NaN })).filter((x) => Number.isFinite(x.changePct));
  const usYield = (() => { const ser = s.us10y; if (!ser || ser.size < 2) return undefined; const d = [...ser.keys()].sort(); return ser.get(d[d.length - 1])! - ser.get(d[d.length - 2])!; })();
  // Asia trades the same day as India; Wall Street's last close before India's session sets the mood.
  const asia: { name: string; pct: number }[] = [];
  for (const [name, k] of [["Nikkei", "nikkei"], ["Hang Seng", "hangseng"], ["KOSPI", "kospi"]] as const) {
    const v = s[k]?.has(session) ? dayChange(s[k], session) : undefined; // only markets that traded that same day
    if (v !== undefined) asia.push({ name, pct: v });
  }
  const usBefore = (k: "spx" | "nasdaq") => { const ser = s[k]; if (!ser) return undefined; const d = [...ser.keys()].filter((x) => x < session).sort().pop(); return d ? { pct: dayChange(ser, d), date: d } : undefined; };
  const us = { spx: usBefore("spx")?.pct, nasdaq: usBefore("nasdaq")?.pct, date: usBefore("spx")?.date };
  const common = { asia, us, sectors, mood, vixPct: ch("vix"), crudePct: dayChange(s.crude), inrPct: dayChange(s.usdinr) };

  const asset = (id: AssetId, name: string, unit: string, ser: Series | undefined, rs: Reason[], news: Headline[]): AssetBrief | null => {
    const price = last(ser), changePct = dayChange(ser);
    if (price === undefined || changePct === undefined) return null;
    const { reasons, against } = arrange(changePct, rs);
    return { id, name, unit, price: r2(price), change: r2(price - price / (1 + changePct / 100)), changePct: r2(changePct), date: lastDate(ser)!, reasons, against, headline: headlineOf(name, changePct, reasons), news };
  };
  const niftyPct = ch("nifty") ?? 0, bankPct = ch("banknifty") ?? 0, sensexPct = ch("sensex") ?? 0;
  const spx = dayChange(s.spx); // US stocks in the same US session as gold's latest close
  const assets = [
    asset("nifty", "Nifty 50", "pts", s.nifty, indexReasons({ ...common, changePct: niftyPct }), newsIdx),
    asset("sensex", "Sensex", "pts", s.sensex, indexReasons({ ...common, changePct: sensexPct }), newsIdx),
    asset("banknifty", "Bank Nifty", "pts", s.banknifty, indexReasons({ ...common, changePct: bankPct, banks: true }), newsBank),
    asset("gold", "Gold", "₹ per 10 g", goldInr, metalReasons({ name: "Gold", changePct: dayChange(goldInr) ?? 0, usdPct: dayChange(s.goldUsd), dxyPct: dayChange(s.dxy), yieldChange: usYield, inrPct: dayChange(s.usdinr), stocksPct: spx }), newsGold),
    asset("silver", "Silver", "₹ per kg", silverInr, metalReasons({ name: "Silver", changePct: dayChange(silverInr) ?? 0, usdPct: dayChange(s.silverUsd), dxyPct: dayChange(s.dxy), yieldChange: usYield, inrPct: dayChange(s.usdinr), stocksPct: spx }), newsSilver),
  ].filter((x): x is AssetBrief => Boolean(x));

  // Day by day: the last 10 NSE sessions, with the biggest sector move that day as the "why".
  const days: DayRow[] = [...(s.nifty?.keys() ?? [])].sort().slice(-10).reverse().map((date) => {
    const nifty = dayChange(s.nifty, date);
    const secs = Object.keys(sectorSyms).map((n) => ({ n, c: dayChange(s[n], date) })).filter((x): x is { n: string; c: number } => x.c !== undefined);
    const lead = nifty === undefined ? undefined : secs.sort((a, b) => (nifty >= 0 ? b.c - a.c : a.c - b.c))[0];
    const crude = dayChange(s.crude, date), inr = dayChange(s.usdinr, date);
    const extra = crude !== undefined && Math.abs(crude) >= 2 ? `; crude ${pct(crude)}` : inr !== undefined && Math.abs(inr) >= 0.3 ? `; rupee ${inr > 0 ? "weaker" : "stronger"}` : "";
    return {
      date, nifty: nifty === undefined ? undefined : r2(nifty), banknifty: r2(dayChange(s.banknifty, date) ?? NaN), gold: r2(dayChange(goldInr, date) ?? NaN),
      usdinr: r2(inr ?? NaN), crude: r2(crude ?? NaN),
      why: lead ? `${lead.n.replace("Nifty ", "")} ${pct(lead.c)} ${nifty! >= 0 ? "led" : "led the fall"}${extra}` : "",
    };
  });

  const context = [
    { name: "India VIX", changePct: r2(ch("vix") ?? 0), note: `level ${last(s.vix)?.toFixed(2) ?? "?"}` },
    { name: "Brent crude", changePct: r2(dayChange(s.crude) ?? 0), note: `$${last(s.crude)?.toFixed(2) ?? "?"} a barrel` },
    { name: "USD/INR", changePct: r2(dayChange(s.usdinr) ?? 0), note: `₹${last(s.usdinr)?.toFixed(2) ?? "?"} per $` },
    { name: "Dollar index", changePct: r2(dayChange(s.dxy) ?? 0), note: `${last(s.dxy)?.toFixed(2) ?? "?"}` },
    { name: "US 10-year yield", changePct: r2(usYield ?? 0), note: `${last(s.us10y)?.toFixed(2) ?? "?"}% (change in points)` },
  ];
  const brief = { at: new Date().toISOString(), session, assets, days, context };
  cache = { at: Date.now(), brief };
  return brief;
}
