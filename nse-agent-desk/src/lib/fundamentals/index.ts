/**
 * Company size (market cap) and earnings (EPS) for Mubashir.
 *  - demo:  fictional figures, labelled as samples
 *  - yahoo: Yahoo Finance fundamentals time series (unofficial). EPS comes
 *           from reported diluted EPS; market cap = shares outstanding × price.
 *
 * Size bands. India's official classification (SEBI/AMFI) is by rank: the top
 * 100 companies are large cap, the next 150 mid cap, the rest small cap. Without
 * the full ranking we use rupee cut-offs that approximate it; adjust them with
 * LARGE_CAP_MIN_CR and MID_CAP_MIN_CR. Stocks below MIN_MARKET_CAP_CR (default
 * ₹300 Cr) are left out of the analysis.
 */
import { listOf } from "../market/universe";
import type { CapSize, Fundamentals } from "../types";

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
export const capThresholds = () => ({
  min: num(process.env.MIN_MARKET_CAP_CR, 300),
  mid: num(process.env.MID_CAP_MIN_CR, 30000),
  large: num(process.env.LARGE_CAP_MIN_CR, 100000),
});

export function classifyCap(marketCapCr: number | undefined, t = capThresholds()): CapSize {
  if (marketCapCr === undefined || !Number.isFinite(marketCapCr)) return "Unknown";
  if (marketCapCr < t.min) return "Too small"; // the minimum applies first, whatever the bands
  if (marketCapCr >= t.large) return "Large";
  if (marketCapCr >= t.mid) return "Mid";
  return "Small";
}

export function epsGrowth(now?: number, before?: number): number | undefined {
  if (now === undefined || before === undefined || before === 0) return undefined;
  // Growth from a loss is not a meaningful percentage.
  if (before < 0) return undefined;
  return Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
}

// ---------- demo ----------
function seeded(str: string) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fictional market cap and EPS. Starter-list stocks get a size that fits their list. */
export function demoFundamentals(symbol: string, price: number, seed: number): Fundamentals {
  const r = seeded(`fund:${symbol}:${seed}`);
  const band = { large: [100000, 1800000], mid: [30000, 95000], small: [1200, 28000] }[listOf(symbol) ?? "small"] ?? [100, 50000];
  const capCr = listOf(symbol) ? band[0] * Math.pow(band[1] / band[0], r()) : 100 * Math.pow(500, r()); // custom symbols can be tiny
  const eps0 = price / (12 + r() * 40); // P/E between 12 and 52
  const loss = r() < 0.06;
  const g = loss ? -1.4 : (r() - 0.22) * 0.75; // roughly -16% .. +58%
  const epsYearAgo = loss ? Math.abs(eps0) * 0.4 : eps0 / (1 + g);
  const epsTTM = loss ? -Math.abs(eps0) * 0.2 : eps0;
  const q = (v: number) => Math.round(v * 100) / 100;
  const history = [3, 2, 1, 0].map((k) => ({ period: `FY${26 - k}`, eps: q(k === 0 ? epsTTM : k === 1 ? epsYearAgo : epsYearAgo / (1 + 0.1 * k * (r() - 0.2))) }));
  return {
    marketCapCr: Math.round(capCr), cap: classifyCap(capCr), epsTTM: q(epsTTM), epsYearAgo: q(epsYearAgo),
    epsGrowth1y: epsGrowth(epsTTM, epsYearAgo), epsBasis: "TTM", epsHistory: history, source: "Sample figures (demo)", sample: true,
  };
}

// ---------- Yahoo fundamentals time series ----------
type Point = { asOfDate: string; periodType?: string; reportedValue?: { raw: number } };

async function yahooFundamentals(symbol: string, price: number): Promise<Fundamentals> {
  const y = symbol.endsWith(".NS") || symbol.endsWith(".BO") ? symbol : `${symbol}.NS`;
  const now = Math.floor(Date.now() / 1000);
  const types = ["quarterlyDilutedEPS", "annualDilutedEPS", "quarterlyOrdinarySharesNumber", "annualOrdinarySharesNumber"];
  const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(y)}` +
    `?symbol=${encodeURIComponent(y)}&type=${types.join(",")}&period1=${now - 6 * 366 * 86400}&period2=${now}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const series: Record<string, { date: string; v: number }[]> = {};
  for (const r of json?.timeseries?.result ?? []) {
    const t = r?.meta?.type?.[0];
    const pts = (r?.[t] as (Point | null)[] | undefined)?.filter((p): p is Point => Boolean(p?.reportedValue)) ?? [];
    if (t) series[t] = pts.map((p) => ({ date: p.asOfDate, v: p.reportedValue!.raw })).sort((a, b) => a.date.localeCompare(b.date));
  }
  const q = series.quarterlyDilutedEPS ?? [], a = series.annualDilutedEPS ?? [];
  const sum = (xs: { v: number }[]) => xs.reduce((s, x) => s + x.v, 0);
  let epsTTM: number | undefined, epsYearAgo: number | undefined, epsBasis: Fundamentals["epsBasis"];
  if (q.length >= 8) { epsTTM = sum(q.slice(-4)); epsYearAgo = sum(q.slice(-8, -4)); epsBasis = "TTM"; }
  else if (a.length >= 2) { epsTTM = a[a.length - 1].v; epsYearAgo = a[a.length - 2].v; epsBasis = "FY"; }
  const shares = (series.quarterlyOrdinarySharesNumber?.at(-1) ?? series.annualOrdinarySharesNumber?.at(-1))?.v;
  const marketCapCr = shares ? Math.round((shares * price) / 1e7) : undefined;
  const r2 = (n?: number) => (n === undefined ? undefined : Math.round(n * 100) / 100);
  return {
    marketCapCr, cap: classifyCap(marketCapCr), epsTTM: r2(epsTTM), epsYearAgo: r2(epsYearAgo), epsBasis,
    epsGrowth1y: epsGrowth(epsTTM, epsYearAgo),
    epsHistory: (a.length ? a : q).slice(-4).map((p) => ({ period: p.date.slice(0, 7), eps: Math.round(p.v * 100) / 100 })),
    source: "Yahoo Finance (unofficial)", sample: false,
  };
}

const unknown = (source: string): Fundamentals => ({ cap: "Unknown", epsHistory: [], source, sample: false });

/** Fundamentals for every symbol. A symbol whose data can't be loaded gets cap "Unknown". */
export async function loadFundamentals(prices: Record<string, number>, demo: boolean, seed = 0): Promise<Record<string, Fundamentals>> {
  const syms = Object.keys(prices);
  if (demo) return Object.fromEntries(syms.map((s) => [s, demoFundamentals(s, prices[s], seed)]));
  if ((process.env.FUNDAMENTALS_PROVIDER ?? "yahoo").toLowerCase() !== "yahoo") return Object.fromEntries(syms.map((s) => [s, unknown("Not configured")]));
  const out: Record<string, Fundamentals> = {};
  const queue = [...syms];
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      try { out[s] = await yahooFundamentals(s, prices[s]); } catch { out[s] = unknown("Unavailable"); }
    }
  }));
  return out;
}
