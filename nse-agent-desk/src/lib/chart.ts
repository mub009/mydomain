/**
 * Research Agent's chart check.
 *  - Trend on five timeframes: 1M, 1D, 4H, 1H, 30m.
 *  - Best buy area: the strongest support zone below today's price, built from
 *    1-month, 3-month, 6-month and 1-year history (swing lows and the price
 *    where the most volume traded).
 */
import { atr, ema, rsi, sma } from "./indicators";
import type { Bar, BuyZone, ChartAnalysis, HistoryWindow, TimeframeView, Trend } from "./types";

const last = <T,>(a: T[]) => a[a.length - 1];
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Merge consecutive bars that share a key into one candle. */
export function aggregate(bars: Bar[], key: (b: Bar, i: number) => string): Bar[] {
  const out: Bar[] = [];
  let cur: Bar | null = null, curKey = "";
  bars.forEach((b, i) => {
    const k = key(b, i);
    if (cur && k === curKey) {
      cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low);
      cur.close = b.close; cur.volume += b.volume;
    } else {
      if (cur) out.push(cur);
      cur = { ...b }; curKey = k;
    }
  });
  if (cur) out.push(cur);
  return out;
}

/** Monthly candles from daily bars. */
export const toMonthly = (daily: Bar[]) => aggregate(daily, (b) => b.date.slice(0, 7));

/** Hourly candles from half-hour bars: 09:15-10:15, 10:15-11:15 ... per day. */
export function toHourly(m30: Bar[]): Bar[] {
  let day = "", idx = 0;
  return aggregate(m30, (b) => {
    const d = b.date.slice(0, 10);
    if (d !== day) { day = d; idx = 0; } else idx++;
    return `${d}:${Math.floor(idx / 2)}`;
  });
}

/** 4-hour candles from hourly bars: two per trading day (09:15-13:15, 13:15-15:30). */
export function to4h(h1: Bar[]): Bar[] {
  let day = "", idx = 0;
  return aggregate(h1, (b) => {
    const d = b.date.slice(0, 10);
    if (d !== day) { day = d; idx = 0; } else idx++;
    return `${d}:${idx < 4 ? "a" : "b"}`;
  });
}

/** Trend on one timeframe: EMA 20/50 alignment plus RSI. */
export function readTimeframe(tf: TimeframeView["tf"], bars: Bar[]): TimeframeView {
  const c = bars.map((b) => b.close);
  if (tf === "1M") {
    // Monthly: compare with the 6-month average and its direction 3 months ago.
    if (c.length < 9) return { tf, trend: "Neutral", rsi: 50, bars: c.length, note: "Not enough monthly history" };
    const s6 = sma(c, 6), now = last(s6), before = s6[s6.length - 4];
    const up = last(c) > now && now > before, down = last(c) < now && now < before;
    const r = last(rsi(c, 6));
    return { tf, trend: up ? "Bullish" : down ? "Bearish" : "Neutral", rsi: round2(r), bars: c.length,
      note: up ? "Above a rising 6-month average" : down ? "Below a falling 6-month average" : "Mixed against the 6-month average" };
  }
  if (c.length < 55) return { tf, trend: "Neutral", rsi: 50, bars: c.length, note: "Not enough bars" };
  const e20 = last(ema(c, 20)), e50 = last(ema(c, 50)), price = last(c), r = last(rsi(c));
  let trend: Trend = "Neutral", note = "EMA20 and EMA50 are mixed";
  if (e20 > e50 && price > e20) { trend = "Bullish"; note = "Price above EMA20, EMA20 above EMA50"; }
  else if (e20 < e50 && price < e20) { trend = "Bearish"; note = "Price below EMA20, EMA20 below EMA50"; }
  if (trend === "Bullish" && r > 75) note += "; RSI overbought";
  if (trend === "Bearish" && r < 30) note += "; RSI oversold";
  return { tf, trend, rsi: round2(r), bars: c.length, note };
}

/** Price level where the most volume traded (simple volume profile, 30 buckets). */
function pointOfControl(bars: Bar[]): number {
  const lo = Math.min(...bars.map((b) => b.low)), hi = Math.max(...bars.map((b) => b.high));
  const n = 30, step = (hi - lo) / n || 1;
  const vol = new Array(n).fill(0);
  for (const b of bars) {
    const typical = (b.high + b.low + b.close) / 3;
    vol[Math.min(n - 1, Math.floor((typical - lo) / step))] += b.volume;
  }
  const i = vol.indexOf(Math.max(...vol));
  return lo + step * (i + 0.5);
}

/** Lows that are the lowest point within 3 bars on each side. */
function swingLows(bars: Bar[], w = 3): number[] {
  const out: number[] = [];
  for (let i = w; i < bars.length - w; i++) {
    const l = bars[i].low;
    let ok = true;
    for (let j = i - w; j <= i + w; j++) if (bars[j].low < l) { ok = false; break; }
    if (ok) out.push(l);
  }
  return out;
}

const WINDOWS: { label: HistoryWindow["label"]; days: number }[] = [
  { label: "1M", days: 21 }, { label: "3M", days: 63 }, { label: "6M", days: 126 }, { label: "1Y", days: 252 },
];

export function historyWindows(daily: Bar[]): HistoryWindow[] {
  const price = last(daily).close;
  return WINDOWS.filter((w) => daily.length >= Math.min(w.days, 21)).map(({ label, days }) => {
    const s = daily.slice(-days);
    const below = swingLows(s).filter((l) => l < price);
    return {
      label, low: round2(Math.min(...s.map((b) => b.low))), high: round2(Math.max(...s.map((b) => b.high))),
      poc: round2(pointOfControl(s)), change: round2((price / s[0].close - 1) * 100),
      support: below.length ? round2(Math.max(...below)) : undefined,
    };
  });
}

/**
 * Best buy area: cluster the support levels found in each history window and
 * pick the cluster confirmed by the most windows (nearest to price on a tie).
 */
export function findBuyZone(daily: Bar[], windows: HistoryWindow[]): BuyZone | null {
  const price = last(daily).close;
  const a = last(atr(daily));
  const levels: { price: number; from: string }[] = [];
  for (const w of windows) {
    if (w.support !== undefined) levels.push({ price: w.support, from: `${w.label} swing low ₹${w.support.toLocaleString("en-IN")}` });
    if (w.poc < price) levels.push({ price: w.poc, from: `${w.label} most-traded price ₹${w.poc.toLocaleString("en-IN")}` });
  }
  if (!levels.length) return null; // price is below every support: no safe area to name

  levels.sort((x, y) => y.price - x.price);
  const clusters: (typeof levels)[] = [];
  for (const l of levels) {
    const c = clusters.find((cl) => Math.abs(cl[0].price - l.price) <= a);
    if (c) c.push(l); else clusters.push([l]);
  }
  const windowsIn = (cl: typeof levels) => new Set(cl.map((l) => l.from.split(" ")[0])).size;
  clusters.sort((x, y) => windowsIn(y) - windowsIn(x) || y.length - x.length || Math.max(...y.map((l) => l.price)) - Math.max(...x.map((l) => l.price)));
  const best = clusters[0];

  const lo = Math.min(...best.map((l) => l.price)) - 0.25 * a;
  const hi = Math.min(price, Math.max(...best.map((l) => l.price)) + 0.25 * a);
  const distancePct = Math.max(0, (price / hi - 1) * 100);
  const plan: BuyZone["plan"] = distancePct <= 1 ? "In buy zone" : distancePct <= 6 ? "Wait for dip" : "Extended";
  return {
    low: round2(lo), high: round2(hi), distancePct: round2(distancePct), plan,
    basis: [...new Set(best.map((l) => l.from))], stop: round2(lo - 0.5 * a),
  };
}

export function analyseChart(daily: Bar[], m30: Bar[] | null, h1in: Bar[] | null): ChartAnalysis {
  const h1 = h1in?.length ? h1in : m30?.length ? toHourly(m30) : null;
  const tfs: TimeframeView[] = [
    readTimeframe("1M", toMonthly(daily)),
    readTimeframe("1D", daily),
  ];
  const unavailable = (tf: TimeframeView["tf"]): TimeframeView => ({ tf, trend: "Neutral", rsi: 50, bars: 0, note: "Intraday data not available" });
  tfs.push(h1 ? readTimeframe("4H", to4h(h1)) : unavailable("4H"));
  tfs.push(h1 ? readTimeframe("1H", h1) : unavailable("1H"));
  tfs.push(m30?.length ? readTimeframe("30m", m30) : unavailable("30m"));
  const history = historyWindows(daily);
  return {
    timeframes: tfs,
    bullish: tfs.filter((t) => t.trend === "Bullish").length,
    bearish: tfs.filter((t) => t.trend === "Bearish").length,
    history, zone: findBuyZone(daily, history), intraday: Boolean(m30?.length),
    closes: daily.slice(-126).map((b) => round2(b.close)),
  };
}
