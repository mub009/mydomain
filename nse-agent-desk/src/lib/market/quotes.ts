/**
 * Current prices for many stocks at once: Yahoo's spark endpoint, 20 stocks per request.
 * Prices are delayed (about 15 minutes during market hours) and kept for 30 seconds.
 */
export interface Quote {
  symbol: string;
  name?: string;
  price: number;
  /** % change from the previous close. */
  changePct: number;
  prevClose?: number;
  /** When the price was set, ISO time. */
  at: string;
}

const BATCH = 20;
const FRESH_MS = 30_000;
const cache = new Map<string, { t: number; q: Quote }>();

/** Reads one spark reply into quotes (exported for tests). */
export function readSpark(json: unknown): Quote[] {
  const out: Quote[] = [];
  const results = (json as { spark?: { result?: unknown[] } })?.spark?.result ?? [];
  for (const r of results as { symbol?: string; response?: { meta?: Record<string, unknown> }[] }[]) {
    const m = r?.response?.[0]?.meta;
    const price = Number(m?.regularMarketPrice);
    if (!m || !(price > 0)) continue;
    const prev = Number(m.chartPreviousClose ?? m.previousClose);
    const change = Number.isFinite(Number(m.regularMarketChangePercent)) ? Number(m.regularMarketChangePercent)
      : prev > 0 ? (price / prev - 1) * 100 : 0;
    out.push({
      symbol: String(r.symbol ?? "").replace(/\.NS$/, ""),
      name: typeof m.longName === "string" ? m.longName : typeof m.shortName === "string" ? m.shortName : undefined,
      price, changePct: Math.round(change * 100) / 100, prevClose: prev > 0 ? prev : undefined,
      at: new Date(Number(m.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString(),
    });
  }
  return out;
}

async function fetchBatch(symbols: string[]): Promise<Quote[]> {
  const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbols.map((s) => `${s}.NS`).join(","))}&range=1d&interval=5m`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return readSpark(await res.json());
}

/** Current prices for up to a few hundred NSE symbols; missing ones are simply left out. */
export async function liveQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const now = Date.now();
  const out: Record<string, Quote> = {};
  const need: string[] = [];
  for (const s of new Set(symbols)) {
    const hit = cache.get(s);
    if (hit && now - hit.t < FRESH_MS) out[s] = hit.q; else need.push(s);
  }
  const batches: string[][] = [];
  for (let i = 0; i < need.length; i += BATCH) batches.push(need.slice(i, i + BATCH));
  await Promise.all(batches.map(async (b) => {
    try { for (const q of await fetchBatch(b)) { out[q.symbol] = q; cache.set(q.symbol, { t: now, q }); } }
    catch { /* leave these out; the page falls back to the last close */ }
  }));
  return out;
}

/** TradingView's chart for an NSE stock (TradingView writes & and - as _). */
export const tradingViewUrl = (symbol: string) =>
  `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(`NSE:${symbol.toUpperCase().replace(/[&-]/g, "_")}`)}`;
