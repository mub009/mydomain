import type { Bar } from "../types";
import type { MarketDataProvider } from "./provider";

const yahooSymbol = (s: string) =>
  s.includes("=") || s.startsWith("^") || /\.(NS|BO|NYB)$/.test(s) ? s : `${s}.NS`;

async function chart(symbol: string, range = "1y", interval = "1d"): Promise<Bar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol))}?range=${range}&interval=${interval}`;
  const intraday = interval !== "1d";
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error(json?.chart?.error?.description ?? "no data");
  const q = r.indicators.quote[0];
  const adj: number[] | undefined = r.indicators.adjclose?.[0]?.adjclose;
  const bars: Bar[] = [];
  const lastIdx = (r.timestamp as number[]).length - 1;
  (r.timestamp as number[]).forEach((t, i) => {
    let c = q.close[i];
    // Yahoo leaves today's daily close empty (even after the close); the live price is in meta.
    if (c == null && i === lastIdx && !intraday && r.meta?.regularMarketPrice) c = r.meta.regularMarketPrice;
    const [o, h, l, v] = [q.open[i], q.high[i], q.low[i], q.volume[i]];
    if ([o, h, l, c].some((x) => x == null)) return;
    const k = adj?.[i] ? adj[i] / c : 1;
    bars.push({ date: intraday ? new Date(t * 1000).toISOString() : new Date(t * 1000).toISOString().slice(0, 10), open: o * k, high: h * k, low: l * k, close: c * k, volume: v ?? 0 });
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
  getLongBars: (symbol) => chart(symbol, "5y", "1wk"),
  getVixBars: () => chart("^INDIAVIX"),
  getLastPrice: async (symbol) => {
    const bars = await chart(symbol, "1d", "5m");
    if (!bars.length) throw new Error("no price");
    return bars[bars.length - 1].close;
  },
  getIntradayBars: (symbol, interval) => chart(symbol, interval === "30m" ? "60d" : "6mo", interval),
};
