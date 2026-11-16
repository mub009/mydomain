import type { Bar } from "../types";

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

/** The last `n` weekdays ending today (or the previous Friday). */
function weekdays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  while (out.length < n) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

/**
 * Fictional sample price history. Deterministic for a given (symbol, seed),
 * and every new seed gives a different market, so each demo run reaches its
 * own conclusion. These are NOT real prices.
 */
export function demoBars(symbol: string, seed: number, days = 260): Bar[] {
  const market = seeded(`market:${seed}`);
  const marketDrift = market.normal(0.0001, 0.0005); // whole-market mood for this run
  const r = seeded(`${symbol}:${seed}`);
  const drift = marketDrift + r.normal(0, 0.0006);
  const vol = r.uniform(0.01, 0.022);
  const rets = Array.from({ length: days }, () => r.normal(drift, vol));
  const shift25 = r.normal(0, 0.0025), shift5 = r.normal(0, 0.004);
  for (let i = days - 25; i < days; i++) rets[i] += shift25;
  for (let i = days - 5; i < days; i++) rets[i] += shift5;

  let price = r.uniform(150, 4000);
  const dates = weekdays(days);
  return rets.map((ret, i) => {
    price *= Math.exp(ret);
    const open = price * (1 + r.normal(0, vol / 3));
    const high = Math.max(open, price) * (1 + Math.abs(r.normal(0, vol / 2)));
    const low = Math.min(open, price) * (1 - Math.abs(r.normal(0, vol / 2)));
    let volume = Math.exp(r.normal(14, 0.35));
    if (i === days - 1) volume *= r.uniform(0.7, 2.5);
    return { date: dates[i], open, high, low, close: price, volume };
  });
}

/** Equal-weight demo index built from the demo stocks (base 100). */
export function demoIndex(all: Bar[][]): number[] {
  const n = Math.min(...all.map((b) => b.length));
  return Array.from({ length: n }, (_, i) =>
    all.reduce((s, bars) => s + (bars[i].close / bars[0].close) * 100, 0) / all.length);
}
