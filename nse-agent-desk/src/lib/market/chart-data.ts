/**
 * Chart bars for the stock modal, from Yahoo Finance (unofficial, delayed).
 * Bar sizes and ranges follow Yahoo's limits: 1-minute bars go back 7 days,
 * 2- to 30-minute bars 60 days, hourly bars about 2 years.
 */
export const INTERVALS = ["1m", "2m", "5m", "15m", "30m", "1h", "1d", "1wk", "1mo"] as const;
export const RANGES = ["1d", "5d", "1mo", "3mo", "6mo", "ytd", "1y", "2y", "5y", "max"] as const;
export type ChartInterval = (typeof INTERVALS)[number];
export type ChartRange = (typeof RANGES)[number];

export const INTERVAL_LABEL: Record<ChartInterval, string> = {
  "1m": "1m", "2m": "2m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1H", "1d": "1D", "1wk": "1W", "1mo": "1M",
};
export const RANGE_LABEL: Record<ChartRange, string> = {
  "1d": "1D", "5d": "5D", "1mo": "1M", "3mo": "3M", "6mo": "6M", ytd: "YTD", "1y": "1Y", "2y": "2Y", "5y": "5Y", max: "Max",
};

/** Longest range each bar size allows. */
const MAX_RANGE: Record<ChartInterval, ChartRange> = {
  "1m": "5d", "2m": "1mo", "5m": "1mo", "15m": "1mo", "30m": "1mo", "1h": "1y", "1d": "max", "1wk": "max", "1mo": "max",
};
/** Bar size picked when you choose a range. */
const DEFAULT_INTERVAL: Record<ChartRange, ChartInterval> = {
  "1d": "2m", "5d": "15m", "1mo": "1h", "3mo": "1d", "6mo": "1d", ytd: "1d", "1y": "1d", "2y": "1d", "5y": "1wk", max: "1mo",
};
const rank = (r: ChartRange) => RANGES.indexOf(r);

export const isIntraday = (i: ChartInterval) => !["1d", "1wk", "1mo"].includes(i);
export const allowed = (i: ChartInterval, r: ChartRange) => rank(r) <= rank(MAX_RANGE[i]) && !(r === "1d" && !isIntraday(i));
/** Choosing a range: keep the bar size if it fits, else use the usual one for that range. */
export const intervalFor = (r: ChartRange, current: ChartInterval): ChartInterval => (allowed(current, r) ? current : DEFAULT_INTERVAL[r]);
/** Choosing a bar size: keep the range if it fits, else the longest range it allows (daily and up need more than one day). */
export const rangeFor = (i: ChartInterval, current: ChartRange): ChartRange =>
  allowed(i, current) ? current : !isIntraday(i) && current === "1d" ? "6mo" : MAX_RANGE[i];

export interface ChartBar { t: number | string; o: number; h: number; l: number; c: number; v: number }
export interface ChartResponse {
  symbol: string; interval: ChartInterval; range: ChartRange; bars: ChartBar[];
  last?: number; prevClose?: number; marketTime?: number; source: string;
}

const cache = new Map<string, { at: number; v: ChartResponse }>();

export async function fetchChart(symbol: string, interval: ChartInterval, range: ChartRange): Promise<ChartResponse> {
  const key = `${symbol}|${interval}|${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (isIntraday(interval) ? 60_000 : 600_000)) return hit.v;
  const y = symbol.startsWith("^") || symbol.includes(".") ? symbol : `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?range=${range}&interval=${interval === "1h" ? "60m" : interval}&includePrePost=false`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(res.status === 404 ? `${symbol} was not found on Yahoo Finance` : `Yahoo Finance returned HTTP ${res.status}`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error(json?.chart?.error?.description ?? "No chart data");
  const q = r.indicators?.quote?.[0] ?? {};
  const intra = isIntraday(interval);
  const bars: ChartBar[] = [];
  const ts0 = (r.timestamp ?? []) as number[];
  ts0.forEach((ts, i) => {
    let c = q.close?.[i];
    // Yahoo leaves today's daily close empty (even after the close); the live price is in meta.
    if (c == null && i === ts0.length - 1 && !intra && r.meta?.regularMarketPrice) c = r.meta.regularMarketPrice;
    const [o, h, l] = [q.open?.[i], q.high?.[i], q.low?.[i]];
    if ([o, h, l, c].some((x) => x == null)) return;
    // Intraday: seconds (UTC). Daily and up: the trading date in IST.
    const t = intra ? ts : new Date((ts + 19800) * 1000).toISOString().slice(0, 10);
    const prev = bars[bars.length - 1];
    if (prev && prev.t === t) return; // Yahoo sometimes repeats the live bar
    bars.push({ t, o, h, l, c, v: q.volume?.[i] ?? 0 });
  });
  const v: ChartResponse = {
    symbol, interval, range, bars, last: r.meta?.regularMarketPrice, prevClose: r.meta?.chartPreviousClose ?? r.meta?.previousClose,
    marketTime: r.meta?.regularMarketTime, source: "Yahoo Finance (unofficial, delayed)",
  };
  cache.set(key, { at: Date.now(), v });
  return v;
}
