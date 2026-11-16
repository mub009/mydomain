/**
 * Market data for NSE stocks.
 * Live: Yahoo Finance chart API through the Vite proxy (/yahoo), `.NS` suffix.
 * Demo: deterministic synthetic prices so the app works offline.
 * Demo data is NOT real market data.
 */
import type { Bar } from "./types";

export const NIFTY50 = [
  "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "BHARTIARTL", "ITC", "SBIN",
  "LT", "HINDUNILVR", "BAJFINANCE", "KOTAKBANK", "AXISBANK", "MARUTI", "SUNPHARMA",
  "HCLTECH", "TITAN", "ULTRACEMCO", "NTPC", "ASIANPAINT", "M&M", "POWERGRID",
  "TATAMOTORS", "WIPRO", "ONGC", "NESTLEIND", "JSWSTEEL", "TATASTEEL", "ADANIPORTS",
  "COALINDIA", "BAJAJFINSV", "TECHM", "GRASIM", "HINDALCO", "CIPLA", "DRREDDY",
  "BRITANNIA", "EICHERMOT", "APOLLOHOSP", "HEROMOTOCO", "DIVISLAB", "TATACONSUM",
  "SBILIFE", "HDFCLIFE", "BPCL", "INDUSINDBK", "ADANIENT", "BAJAJ-AUTO", "SHRIRAMFIN",
  "TRENT",
];

const INDEX = "^NSEI";

const yahooSymbol = (s: string) =>
  s.startsWith("^") || s.endsWith(".NS") || s.endsWith(".BO") ? s : `${s}.NS`;

export async function fetchLive(symbol: string): Promise<Bar[]> {
  const url = `/yahoo/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol))}?range=1y&interval=1d`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error(json?.chart?.error?.description ?? "no data");
  const q = r.indicators.quote[0];
  const adj: number[] | undefined = r.indicators.adjclose?.[0]?.adjclose;
  const bars: Bar[] = [];
  (r.timestamp as number[]).forEach((t, i) => {
    const [o, h, l, c, v] = [q.open[i], q.high[i], q.low[i], q.close[i], q.volume[i]];
    if ([o, h, l, c].some((x) => x == null)) return;
    const k = adj?.[i] ? adj[i] / c : 1; // adjust for splits/dividends
    bars.push({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      open: o * k, high: h * k, low: l * k, close: c * k, volume: v ?? 0,
    });
  });
  return bars;
}

// ---------- demo data ----------
function seeded(str: string) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = (mu = 0, sd = 1) =>
    mu + sd * Math.sqrt(-2 * Math.log(rand() || 1e-12)) * Math.cos(2 * Math.PI * rand());
  const uniform = (lo: number, hi: number) => lo + (hi - lo) * rand();
  return { normal, uniform };
}

export function fetchDemo(symbol: string, days = 260): Bar[] {
  const r = seeded(symbol);
  const drift = r.normal(0.0002, 0.0006);
  const vol = r.uniform(0.01, 0.022);
  const rets = Array.from({ length: days }, () => r.normal(drift, vol));
  const shift25 = r.normal(0, 0.0025), shift5 = r.normal(0, 0.004);
  for (let i = days - 25; i < days; i++) rets[i] += shift25;
  for (let i = days - 5; i < days; i++) rets[i] += shift5;

  let price = r.uniform(150, 4000);
  const end = new Date("2026-11-13");
  const bars: Bar[] = [];
  for (let i = 0; i < days; i++) {
    price *= Math.exp(rets[i]);
    const open = price * (1 + r.normal(0, vol / 3));
    const high = Math.max(open, price) * (1 + Math.abs(r.normal(0, vol / 2)));
    const low = Math.min(open, price) * (1 - Math.abs(r.normal(0, vol / 2)));
    let volume = Math.exp(r.normal(14, 0.35));
    if (i === days - 1) volume *= r.uniform(0.7, 2.5);
    const d = new Date(end);
    d.setDate(end.getDate() - Math.round((days - 1 - i) * 1.4));
    bars.push({ date: d.toISOString().slice(0, 10), open, high, low, close: price, volume });
  }
  return bars;
}

/** Equal-weight demo index built from the demo stocks. */
function demoIndex(all: Bar[][]): number[] {
  const n = Math.min(...all.map((b) => b.length));
  return Array.from({ length: n }, (_, i) =>
    all.reduce((s, bars) => s + (bars[i].close / bars[0].close) * 100, 0) / all.length);
}

export interface Loaded {
  frames: Record<string, Bar[]>;
  indexClose: number[];
  mode: "live" | "demo";
  skipped: string[];
}

export async function load(
  symbols: string[], demo: boolean, onProgress?: (done: number, total: number) => void,
): Promise<Loaded> {
  if (!demo) {
    const frames: Record<string, Bar[]> = {};
    const skipped: string[] = [];
    let done = 0;
    const queue = [...symbols];
    const worker = async () => {
      for (let sym = queue.shift(); sym; sym = queue.shift()) {
        try {
          const bars = await fetchLive(sym);
          if (bars.length >= 60) frames[sym] = bars; else skipped.push(`${sym} (not enough history)`);
        } catch (e) {
          skipped.push(`${sym} (${(e as Error).message})`);
        }
        onProgress?.(++done, symbols.length);
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
    if (Object.keys(frames).length) {
      let indexClose: number[] = [];
      try { indexClose = (await fetchLive(INDEX)).map((b) => b.close); } catch { /* index optional */ }
      return { frames, indexClose, mode: "live", skipped };
    }
  }
  const frames = Object.fromEntries(symbols.map((s) => [s, fetchDemo(s)]));
  onProgress?.(symbols.length, symbols.length);
  return { frames, indexClose: demoIndex(Object.values(frames)), mode: "demo", skipped: [] };
}
