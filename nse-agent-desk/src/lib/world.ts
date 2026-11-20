/**
 * World markets: each country's main stock index from Yahoo Finance (delayed),
 * with today's and 1-month change, a 1-month line and whether the market is
 * open now (from the exchange's own trading hours for today).
 */
export interface WorldIndexDef { symbol: string; name: string; country: string; flag: string; region: "India" | "Asia-Pacific" | "Europe" | "Americas" | "Middle East & Africa" }
export const WORLD_INDICES: WorldIndexDef[] = [
  { symbol: "^NSEI", name: "Nifty 50", country: "India", flag: "🇮🇳", region: "India" },
  { symbol: "^BSESN", name: "Sensex", country: "India", flag: "🇮🇳", region: "India" },
  { symbol: "^N225", name: "Nikkei 225", country: "Japan", flag: "🇯🇵", region: "Asia-Pacific" },
  { symbol: "000001.SS", name: "SSE Composite", country: "China", flag: "🇨🇳", region: "Asia-Pacific" },
  { symbol: "^HSI", name: "Hang Seng", country: "Hong Kong", flag: "🇭🇰", region: "Asia-Pacific" },
  { symbol: "^KS11", name: "KOSPI", country: "South Korea", flag: "🇰🇷", region: "Asia-Pacific" },
  { symbol: "^TWII", name: "TAIEX", country: "Taiwan", flag: "🇹🇼", region: "Asia-Pacific" },
  { symbol: "^STI", name: "Straits Times", country: "Singapore", flag: "🇸🇬", region: "Asia-Pacific" },
  { symbol: "^AXJO", name: "S&P/ASX 200", country: "Australia", flag: "🇦🇺", region: "Asia-Pacific" },
  { symbol: "^NZ50", name: "NZX 50", country: "New Zealand", flag: "🇳🇿", region: "Asia-Pacific" },
  { symbol: "^JKSE", name: "IDX Composite", country: "Indonesia", flag: "🇮🇩", region: "Asia-Pacific" },
  { symbol: "^KLSE", name: "FTSE Bursa Malaysia KLCI", country: "Malaysia", flag: "🇲🇾", region: "Asia-Pacific" },
  { symbol: "^SET.BK", name: "SET Index", country: "Thailand", flag: "🇹🇭", region: "Asia-Pacific" },
  { symbol: "PSEI.PS", name: "PSEi", country: "Philippines", flag: "🇵🇭", region: "Asia-Pacific" },
  { symbol: "^FTSE", name: "FTSE 100", country: "United Kingdom", flag: "🇬🇧", region: "Europe" },
  { symbol: "^GDAXI", name: "DAX", country: "Germany", flag: "🇩🇪", region: "Europe" },
  { symbol: "^FCHI", name: "CAC 40", country: "France", flag: "🇫🇷", region: "Europe" },
  { symbol: "^STOXX50E", name: "Euro Stoxx 50", country: "Eurozone", flag: "🇪🇺", region: "Europe" },
  { symbol: "^AEX", name: "AEX", country: "Netherlands", flag: "🇳🇱", region: "Europe" },
  { symbol: "^IBEX", name: "IBEX 35", country: "Spain", flag: "🇪🇸", region: "Europe" },
  { symbol: "FTSEMIB.MI", name: "FTSE MIB", country: "Italy", flag: "🇮🇹", region: "Europe" },
  { symbol: "^SSMI", name: "SMI", country: "Switzerland", flag: "🇨🇭", region: "Europe" },
  { symbol: "^OMX", name: "OMX Stockholm 30", country: "Sweden", flag: "🇸🇪", region: "Europe" },
  { symbol: "XU100.IS", name: "BIST 100", country: "Turkey", flag: "🇹🇷", region: "Europe" },
  { symbol: "^GSPC", name: "S&P 500", country: "United States", flag: "🇺🇸", region: "Americas" },
  { symbol: "^DJI", name: "Dow Jones", country: "United States", flag: "🇺🇸", region: "Americas" },
  { symbol: "^IXIC", name: "Nasdaq Composite", country: "United States", flag: "🇺🇸", region: "Americas" },
  { symbol: "^GSPTSE", name: "S&P/TSX Composite", country: "Canada", flag: "🇨🇦", region: "Americas" },
  { symbol: "^BVSP", name: "Ibovespa", country: "Brazil", flag: "🇧🇷", region: "Americas" },
  { symbol: "^MXX", name: "S&P/BMV IPC", country: "Mexico", flag: "🇲🇽", region: "Americas" },
  { symbol: "^MERV", name: "MERVAL", country: "Argentina", flag: "🇦🇷", region: "Americas" },
  { symbol: "^TA125.TA", name: "TA-125", country: "Israel", flag: "🇮🇱", region: "Middle East & Africa" },
  { symbol: "DFMGI.AE", name: "DFM General", country: "UAE (Dubai)", flag: "🇦🇪", region: "Middle East & Africa" },
  { symbol: "^CASE30", name: "EGX 30", country: "Egypt", flag: "🇪🇬", region: "Middle East & Africa" },
  { symbol: "^J203.JO", name: "JSE All Share", country: "South Africa", flag: "🇿🇦", region: "Middle East & Africa" },
];

export interface WorldQuote extends WorldIndexDef {
  price?: number; change1d?: number; change1m?: number; currency?: string; timezone?: string;
  open: boolean; asOf?: string; spark: number[]; error?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

async function quote(def: WorldIndexDef): Promise<WorldQuote> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(def.symbol)}?range=1mo&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const r = (await res.json())?.chart?.result?.[0];
    if (!r) throw new Error("no data");
    const m = r.meta, ts: number[] = r.timestamp ?? [], cl: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
    const pts = ts.map((t, i) => ({ t, c: cl[i] })).filter((p): p is { t: number; c: number } => p.c != null);
    const price: number | undefined = m.regularMarketPrice ?? pts.at(-1)?.c;
    const off = (m.gmtoffset ?? 0) * 1000, day = (t: number) => new Date(t * 1000 + off).toISOString().slice(0, 10);
    // previous close: the last bar before the latest trading day
    const lastDay = m.regularMarketTime ? day(m.regularMarketTime) : pts.length ? day(pts[pts.length - 1].t) : "";
    const before = pts.filter((p) => day(p.t) < lastDay);
    const prev = before.at(-1)?.c;
    const now = Date.now() / 1000, reg = m.currentTradingPeriod?.regular;
    return {
      ...def, price, currency: m.currency, timezone: m.exchangeTimezoneName,
      change1d: price && prev ? r2((price / prev - 1) * 100) : undefined,
      change1m: price && pts[0] ? r2((price / pts[0].c - 1) * 100) : undefined,
      open: Boolean(reg && now >= reg.start && now < reg.end && lastDay === day(now)),
      asOf: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : undefined,
      spark: pts.map((p) => r2(p.c)),
    };
  } catch (e) {
    return { ...def, open: false, spark: [], error: (e as Error).message };
  }
}

let cache: { at: number; v: WorldQuote[] } | null = null;
export async function worldQuotes(): Promise<WorldQuote[]> {
  if (cache && Date.now() - cache.at < 120_000) return cache.v;
  const out: WorldQuote[] = new Array(WORLD_INDICES.length);
  let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let i = next++; i < WORLD_INDICES.length; i = next++) out[i] = await quote(WORLD_INDICES[i]);
  }));
  cache = { at: Date.now(), v: out };
  return out;
}

/** One line on overnight global markets for the agents (US close, then Asia). */
export function globalCues(q: WorldQuote[]): string | null {
  const pick = ["^GSPC", "^IXIC", "^N225", "^HSI", "^GDAXI"].map((s) => q.find((x) => x.symbol === s)).filter((x): x is WorldQuote => Boolean(x && x.change1d !== undefined));
  if (!pick.length) return null;
  return pick.map((x) => `${x.name} ${x.change1d! >= 0 ? "+" : ""}${x.change1d}%`).join(", ");
}
