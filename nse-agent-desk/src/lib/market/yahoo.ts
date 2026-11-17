import type { Bar } from "../types";
import type { MarketDataProvider } from "./provider";

const yahooSymbol = (s: string) =>
  s.startsWith("^") || s.endsWith(".NS") || s.endsWith(".BO") ? s : `${s}.NS`;

async function chart(symbol: string): Promise<Bar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol))}?range=1y&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
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
    const k = adj?.[i] ? adj[i] / c : 1;
    bars.push({ date: new Date(t * 1000).toISOString().slice(0, 10), open: o * k, high: h * k, low: l * k, close: c * k, volume: v ?? 0 });
  });
  return bars;
}

/**
 * Yahoo Finance daily bars. This is an unofficial, unlicensed, end-of-day
 * source: fine for personal research, but NOT real-time NSE data and not
 * suitable for production redistribution.
 */
export const yahooProvider: MarketDataProvider = {
  id: "yahoo",
  label: "Yahoo Finance (unofficial, end-of-day)",
  realtime: false,
  getDailyBars: chart,
  getIndexBars: () => chart("^NSEI"),
};
