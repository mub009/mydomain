/**
 * Long swing: stocks turning up from a bottom.
 * A stock well below its 52-week high that has made a bottom in the last ~6 months,
 * bounced off it and shows signs of a turn (higher low, back above its averages,
 * RSI recovering from oversold, MACD rising, buyers on up days).
 * Plan: buy near today's price, stop-loss under the recent low, target part of the way
 * back to the old high, held for about 3 weeks to 3 months.
 */
import { atr, macd, rsi, sma } from "./indicators";
import type { Bar } from "./types";

export const LONG_SWING = "Long swing · 3 weeks-3 months";
/** Longest hold for a long swing, in trading days (~3 months). */
export const LONG_SWING_DAYS = 60;

export interface BottomSetup {
  /** 0-100: how clearly the stock is turning up from its bottom. */
  score: number;
  /** True when it qualifies as a long swing (score 70+, the basic shape, and a stop within 12%). */
  isSetup: boolean;
  /** The bottom: lowest low of the last ~6 months, and its date. */
  low: number;
  lowDate: string;
  /** % above that low, and % below the 52-week high. */
  offLowPct: number;
  offHighPct: number;
  high52w: number;
  signals: string[];
  warnings: string[];
  entry: number;
  stopLoss: number;
  target: number;
}

/** A setup needs this score, a bounce of at most this % off the low, and a stop at most this % away. */
export const MIN_SCORE = 70;
export const MAX_OFF_LOW = 20;
export const MAX_RISK_PCT = 12;

const r2 = (x: number) => Math.round(x * 100) / 100;
const lastOf = (a: number[], back = 0) => a[a.length - 1 - back];

export function bottomSetup(bars: Bar[]): BottomSetup | null {
  if (bars.length < 120) return null;
  const c = bars.map((b) => b.close);
  const close = lastOf(c);
  const win = bars.slice(-120);
  let lowIdx = 0;
  win.forEach((b, i) => { if (b.low < win[lowIdx].low) lowIdx = i; });
  const low = win[lowIdx].low;
  const barsSinceLow = win.length - 1 - lowIdx;
  const high52w = Math.max(...bars.slice(-252).map((b) => b.high));
  const offLowPct = (close / low - 1) * 100;
  const offHighPct = (1 - close / high52w) * 100;

  const sma20 = sma(c, 20), sma50 = sma(c, 50);
  const s200 = c.length >= 200 ? lastOf(sma(c, 200)) : NaN;
  const r = rsi(c), m = macd(c), a = lastOf(atr(bars));
  const signals: string[] = [], warnings: string[] = [];
  let score = 0;

  // The basic shape: it fell, made a bottom at least a week ago, and has bounced but not run away.
  const fell = offHighPct >= 15; // still well below the old high
  const based = barsSinceLow >= 5;
  const bounced = offLowPct >= 3 && offLowPct <= MAX_OFF_LOW;
  if (fell && based && bounced) { score += 20; signals.push(`Bounced ${offLowPct.toFixed(1)}% off its ${win[lowIdx].date.slice(0, 10)} low of ₹${r2(low)}, still ${offHighPct.toFixed(0)}% below its 52-week high`); }
  else if (!fell) warnings.push("Not far enough below its 52-week high to be a bottom");
  else if (!based) warnings.push("Still making new lows");
  else warnings.push(offLowPct < 3 ? "Hasn't bounced off the low yet" : "Already far above the low");

  const recentLow = Math.min(...bars.slice(-10).map((b) => b.low));
  if (based && recentLow > low * 1.02) { score += 15; signals.push(`Higher low: ₹${r2(recentLow)} over the last 2 weeks, above the bottom`); }
  if (close > lastOf(sma20)) { score += 10; signals.push("Back above its 20-day average"); }
  if (lastOf(sma20) > lastOf(sma20, 5)) { score += 10; signals.push("20-day average turning up"); }
  if (close > lastOf(sma50)) { score += 10; signals.push("Reclaimed its 50-day average"); } else warnings.push("Still below its 50-day average");
  const minRsi = Math.min(...r.slice(-40));
  const rsiNow = lastOf(r);
  if (minRsi < 35 && rsiNow >= 45 && rsiNow <= 70) { score += 15; signals.push(`RSI recovered from ${minRsi.toFixed(0)} (oversold) to ${rsiNow.toFixed(0)}`); }
  if (rsiNow > 70) warnings.push(`RSI ${rsiNow.toFixed(0)}: stretched after the bounce`);
  if (lastOf(m.hist) > lastOf(m.hist, 3) && lastOf(m.hist) > -a * 0.05) { score += 10; signals.push("MACD turning up"); }
  const last10 = bars.slice(-10);
  const upVol = last10.filter((b, i) => i && b.close > last10[i - 1].close).map((b) => b.volume);
  const dnVol = last10.filter((b, i) => i && b.close < last10[i - 1].close).map((b) => b.volume);
  const avg = (x: number[]) => (x.length ? x.reduce((p, q) => p + q, 0) / x.length : 0);
  if (upVol.length && avg(upVol) > avg(dnVol) * 1.1) { score += 10; signals.push("More volume on up days than down days"); }
  if (Number.isFinite(s200) && close < s200) warnings.push("Below its 200-day average: a longer recovery");
  if (!fell || !based || !bounced) score = Math.min(score, 40);
  score = Math.min(100, score);

  // Plan: stop under the recent low (at least 1.5 ATR away), target halfway back to the old high, at least 2:1.
  const swingLow = Math.min(...bars.slice(-20).map((b) => b.low));
  const stop = Math.min(swingLow * 0.98, close - 1.5 * a);
  const risk = close - stop;
  const riskPct = (risk / close) * 100;
  const tight = riskPct <= MAX_RISK_PCT;
  if (!tight) warnings.push(`Stop-loss under the recent low would be ${riskPct.toFixed(0)}% away: too wide`);
  const halfway = low + 0.5 * (high52w - low);
  const target = Math.max(close + 2 * risk, Math.min(halfway, high52w));

  return {
    score, isSetup: fell && based && bounced && tight && score >= MIN_SCORE,
    low: r2(low), lowDate: win[lowIdx].date.slice(0, 10), offLowPct: r2(offLowPct), offHighPct: r2(offHighPct), high52w: r2(high52w),
    signals, warnings, entry: r2(close), stopLoss: r2(stop), target: r2(target),
  };
}
