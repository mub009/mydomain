/**
 * Price forecast: a range, not a prediction.
 *
 * Simulates 2,000 possible price paths for the next `horizon` trading days by
 * re-sampling the stock's own daily moves from the past year (so fat tails and
 * crash days are included), scaled to its recent volatility. Trend: half of the
 * stock's average daily move over the past year (shrunk towards zero, because
 * past trends often don't continue).
 *
 * From the paths it reports the 50% and 80% price ranges for each future day,
 * and how often the price touches the target before the stop-loss.
 *
 * Calibration: for each week of the past year it builds the same kind of 80%
 * range using only data available then, and checks whether the real price
 * `horizon` days later landed inside. Close to 80% means the ranges have been
 * trustworthy for this stock.
 */
import type { Bar } from "./types";

export interface ForecastPoint { t: number; close?: number; p10?: number; p25?: number; p50?: number; p75?: number; p90?: number }
export interface Forecast {
  horizon: number;
  points: ForecastPoint[]; // t < 0: history, t = 0: today, t > 0: forecast
  last: number;
  probTarget: number; // % of paths touching target before stop
  probStop: number;
  probNeither: number;
  probUp: number; // % of paths ending above today's price
  median: number;
  range80: [number, number];
  dailyVol: number; // % per day
  drift: number; // % per day assumed
  calibration: { coverage: number; checks: number } | null;
  paths: number;
}

function rng(seedStr: string) {
  let h = 2166136261;
  for (const ch of seedStr) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const quantile = (sorted: number[], q: number) => {
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Recent volatility (exponentially weighted, λ = 0.94) of daily log returns. */
function ewmaVol(rets: number[]): number {
  let v = rets.slice(0, 20).reduce((s, x) => s + x * x, 0) / Math.min(20, rets.length);
  for (const r of rets.slice(20)) v = 0.94 * v + 0.06 * r * r;
  return Math.sqrt(v);
}

export function forecast(bars: Bar[], o: { horizon: number; stop: number; target: number; seed: string; paths?: number }): Forecast {
  const closes = bars.map((b) => b.close);
  const last = closes[closes.length - 1];
  const rets = closes.slice(1).map((c, i) => Math.log(c / closes[i])).slice(-250);
  const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
  const sdHist = Math.sqrt(rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1)) || 1e-6;
  const sdNow = ewmaVol(rets);
  const drift = mean * 0.5;
  // demeaned moves, rescaled to today's volatility
  const pool = rets.map((r) => ((r - mean) * sdNow) / sdHist);

  const N = o.paths ?? 2000, H = o.horizon;
  const rand = rng(o.seed);
  const byDay: number[][] = Array.from({ length: H }, () => []);
  let hitT = 0, hitS = 0, up = 0;
  for (let p = 0; p < N; p++) {
    let lp = Math.log(last), done = false;
    for (let d = 0; d < H; d++) {
      lp += drift + pool[Math.floor(rand() * pool.length)];
      const px = Math.exp(lp);
      byDay[d].push(px);
      if (!done) {
        if (px >= o.target) { hitT++; done = true; } else if (px <= o.stop) { hitS++; done = true; }
      }
    }
    if (Math.exp(lp) > last) up++;
  }

  const points: ForecastPoint[] = closes.slice(-60).map((c, i, a) => ({ t: i - (a.length - 1), close: r2(c) }));
  points[points.length - 1] = { ...points[points.length - 1], p10: r2(last), p25: r2(last), p50: r2(last), p75: r2(last), p90: r2(last) };
  byDay.forEach((xs, d) => {
    xs.sort((a, b) => a - b);
    points.push({ t: d + 1, p10: r2(quantile(xs, 0.1)), p25: r2(quantile(xs, 0.25)), p50: r2(quantile(xs, 0.5)), p75: r2(quantile(xs, 0.75)), p90: r2(quantile(xs, 0.9)) });
  });
  const end = points[points.length - 1];

  // Walk-forward check of the 80% range over the past year.
  let inside = 0, checks = 0;
  for (let t = Math.max(60, closes.length - 252); t + H < closes.length; t += 5) {
    const past = closes.slice(Math.max(0, t - 250), t + 1);
    const pr = past.slice(1).map((c, i) => Math.log(c / past[i]));
    if (pr.length < 40) continue;
    const m = pr.reduce((s, x) => s + x, 0) / pr.length;
    const s = ewmaVol(pr);
    const lo = closes[t] * Math.exp(m * 0.5 * H - 1.2816 * s * Math.sqrt(H));
    const hi = closes[t] * Math.exp(m * 0.5 * H + 1.2816 * s * Math.sqrt(H));
    const actual = closes[t + H];
    checks++;
    if (actual >= lo && actual <= hi) inside++;
  }

  const pct = (n: number) => Math.round((n / N) * 1000) / 10;
  return {
    horizon: H, points, last: r2(last),
    probTarget: pct(hitT), probStop: pct(hitS), probNeither: Math.round((100 - pct(hitT) - pct(hitS)) * 10) / 10, probUp: pct(up),
    median: end.p50!, range80: [end.p10!, end.p90!],
    dailyVol: r2(sdNow * 100), drift: Math.round(drift * 10000) / 100,
    calibration: checks >= 10 ? { coverage: Math.round((inside / checks) * 100), checks } : null,
    paths: N,
  };
}
