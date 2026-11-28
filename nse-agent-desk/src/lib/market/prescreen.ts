/**
 * Quick scan for big lists (Nifty 500, all NSE): one year of closing prices for 20 stocks
 * per request, a simple trend and momentum score, and the best ones go on to the full research.
 */
export interface QuickRow {
  symbol: string;
  close: number;
  /** Returns over 1 and 3 months, %. */
  ret21: number;
  ret63: number;
  /** How far below the 52-week high, % (0 = at the high). */
  offHigh: number;
  above50: boolean;
  above200: boolean;
  /** Today's traded value, ₹ crore (volume × price). */
  tradedCr: number;
  /** 0-100: turning up from a bottom (long swing candidate); 0 when it isn't near one. */
  bottom: number;
  score: number;
}

export interface QuickScan {
  total: number;
  priced: number;
  /** Left out: too few prices, under ₹10, or under ₹1 crore traded today. */
  thin: number;
  /** How many of the shortlist were kept as long swing (bottom) candidates. */
  bottoms?: number;
  shortlist: QuickRow[];
}

const BATCH = 20;
const ys = (s: string) => `${s}.NS`;

interface SparkSeries { close: number[]; high52?: number; volume?: number }

async function spark(symbols: string[]): Promise<Record<string, SparkSeries>> {
  const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbols.map(ys).join(","))}&range=1y&interval=1d`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (res.status === 429 && attempt < 2) { await new Promise((r) => setTimeout(r, 800 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const out: Record<string, SparkSeries> = {};
    for (const r of json?.spark?.result ?? []) {
      const q = r?.response?.[0];
      const close = ((q?.indicators?.quote?.[0]?.close ?? []) as (number | null)[]).filter((c): c is number => typeof c === "number" && c > 0);
      const sym = String(r?.symbol ?? "").replace(/\.NS$/, "");
      if (sym && close.length) out[sym] = { close, high52: q?.meta?.fiftyTwoWeekHigh, volume: q?.meta?.regularMarketVolume };
    }
    return out;
  }
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Score one stock from its closing prices; null when there isn't enough history or trading. */
export function quickRow(symbol: string, s: SparkSeries): Omit<QuickRow, "score"> | null {
  const c = s.close;
  if (c.length < 60) return null;
  const last = c[c.length - 1];
  const back = (n: number) => c[Math.max(0, c.length - 1 - n)];
  const high = Math.max(s.high52 ?? 0, ...c);
  // Bottom check on closes: the lowest close of ~6 months, how long ago, and the bounce since.
  const win = c.slice(-120);
  let li = 0; win.forEach((x, i) => { if (x < win[li]) li = i; });
  const offLow = (last / win[li] - 1) * 100, lowAgo = win.length - 1 - li;
  const sma20 = avg(c.slice(-20)), sma20prev = avg(c.slice(-25, -5));
  const nearBottom = (1 - last / high) * 100 >= 15 && lowAgo >= 5 && offLow >= 3 && offLow <= 30;
  const bottom = nearBottom ? 40 * Number(last > sma20) + 30 * Number(sma20 > sma20prev) + 30 * Number(last > back(21)) : 0;
  return {
    symbol, close: last,
    ret21: (last / back(21) - 1) * 100,
    ret63: (last / back(63) - 1) * 100,
    offHigh: high > 0 ? (1 - last / high) * 100 : 100,
    above50: last > avg(c.slice(-50)),
    above200: c.length >= 200 ? last > avg(c.slice(-200)) : last > avg(c),
    tradedCr: ((s.volume ?? 0) * last) / 1e7,
    bottom,
  };
}

/** Percentile ranks (0-1) of each value. */
function ranks(xs: number[]): number[] {
  const order = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(xs.length);
  order.forEach(([, i], k) => { out[i] = xs.length > 1 ? k / (xs.length - 1) : 1; });
  return out;
}

/**
 * Ranks stocks by 1-month and 3-month strength, closeness to the 52-week high and position above
 * the 50- and 200-day averages. Very cheap (under ₹10) or barely traded (under ₹1 crore today) shares are left out.
 */
export function rankQuick(rows: Omit<QuickRow, "score">[]): QuickRow[] {
  const r21 = ranks(rows.map((r) => r.ret21));
  const r63 = ranks(rows.map((r) => r.ret63));
  const near = ranks(rows.map((r) => -r.offHigh));
  return rows
    .map((r, i) => ({ ...r, score: Math.round((0.3 * r21[i] + 0.3 * r63[i] + 0.2 * near[i] + 0.1 * Number(r.above50) + 0.1 * Number(r.above200)) * 1000) / 10 }))
    .sort((a, b) => b.score - a.score);
}

export const isThin = (r: Omit<QuickRow, "score">) => r.close < 10 || r.tradedCr < 1;

/** Share of the shortlist kept for stocks turning up from a bottom (long swing): 40 of 150, 66 of 250, 106 of 400. */
export const BOTTOM_SHARE = 40 / 150;

/** The strongest by trend and momentum, plus the clearest turns from a bottom (score 70+). */
export function shortlist(ranked: QuickRow[], keep: number): { rows: QuickRow[]; bottoms: number } {
  const bottomRows = ranked.filter((r) => r.bottom >= 70).sort((a, b) => b.bottom - a.bottom || b.ret21 - a.ret21).slice(0, Math.min(Math.round(keep * BOTTOM_SHARE), Math.floor(keep / 3)));
  const taken = new Set(bottomRows.map((r) => r.symbol));
  const strong = ranked.filter((r) => !taken.has(r.symbol)).slice(0, keep - bottomRows.length);
  return { rows: [...strong, ...bottomRows], bottoms: bottomRows.length };
}

/** Quick-scan the whole list and keep the best `keep` stocks for the full research. */
export async function quickScan(symbols: string[], keep: number, onProgress?: (done: number, total: number) => void): Promise<QuickScan> {
  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += BATCH) batches.push(symbols.slice(i, i + BATCH));
  const rows: Omit<QuickRow, "score">[] = [];
  let done = 0; let priced = 0; let thin = 0;
  const queue = [...batches];
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let b = queue.shift(); b; b = queue.shift()) {
      try {
        const got = await spark(b);
        for (const [sym, s] of Object.entries(got)) {
          priced++;
          const row = quickRow(sym, s);
          if (!row || isThin(row)) { thin++; continue; }
          rows.push(row);
        }
      } catch { /* a failed batch is skipped; the rest still count */ }
      done += b.length;
      onProgress?.(Math.min(done, symbols.length), symbols.length);
    }
  }));
  const { rows: list, bottoms } = shortlist(rankQuick(rows), keep);
  return { total: symbols.length, priced, thin, shortlist: list, bottoms };
}
