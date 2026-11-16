import type { Bar, Snapshot } from "./types";

const last = (a: number[], back = 0) => a[a.length - 1 - back];

export function sma(v: number[], n: number): number[] {
  const out = new Array(v.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i];
    if (i >= n) sum -= v[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

/** Exponential average. alpha defaults to 2/(n+1); Wilder smoothing uses 1/n. */
export function ema(v: number[], n: number, alpha = 2 / (n + 1)): number[] {
  const out: number[] = [];
  v.forEach((x, i) => out.push(i === 0 ? x : alpha * x + (1 - alpha) * out[i - 1]));
  return out;
}

export function rsi(close: number[], n = 14): number[] {
  const gains = [0], losses = [0];
  for (let i = 1; i < close.length; i++) {
    const d = close[i] - close[i - 1];
    gains.push(Math.max(d, 0));
    losses.push(Math.max(-d, 0));
  }
  const g = ema(gains, n, 1 / n), l = ema(losses, n, 1 / n);
  return g.map((x, i) => 100 - 100 / (1 + x / (l[i] || 1e-9)));
}

export function macd(close: number[]) {
  const fast = ema(close, 12), slow = ema(close, 26);
  const line = fast.map((x, i) => x - slow[i]);
  const signal = ema(line, 9);
  return { line, signal, hist: line.map((x, i) => x - signal[i]) };
}

export function atr(bars: Bar[], n = 14): number[] {
  const tr = bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const pc = bars[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
  });
  return ema(tr, n, 1 / n);
}

export function pctReturn(close: number[], days: number): number {
  if (close.length <= days) return 0;
  return (last(close) / last(close, days) - 1) * 100;
}

function std(v: number[]): number {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}

/** Every number the agents need, for the most recent bar. */
export function snapshot(bars: Bar[]): Snapshot {
  const c = bars.map((b) => b.close);
  const vol = bars.map((b) => b.volume);
  const m = macd(c);
  const a = last(atr(bars));
  const vol20 = last(sma(vol, 20));
  const prev20 = bars.slice(-21, -1);
  const dailyRets = c.slice(-22).map((x, i, arr) => (i ? x / arr[i - 1] - 1 : 0)).slice(1);
  return {
    close: last(c),
    rsi: last(rsi(c)),
    ema9: last(ema(c, 9)),
    ema21: last(ema(c, 21)),
    sma20: last(sma(c, 20)),
    sma50: last(sma(c, 50)),
    sma200: c.length >= 200 ? last(sma(c, 200)) : NaN,
    macd: last(m.line),
    macdSignal: last(m.signal),
    macdHist: last(m.hist),
    macdHistPrev: last(m.hist, 1),
    atr: a,
    atrPct: (a / last(c)) * 100,
    volRatio: vol20 ? last(vol) / vol20 : 1,
    high20: Math.max(...prev20.map((b) => b.high)),
    high52w: Math.max(...bars.slice(-252).map((b) => b.high)),
    ret1d: pctReturn(c, 1),
    ret5d: pctReturn(c, 5),
    ret21d: pctReturn(c, 21),
    volatility21d: std(dailyRets) * Math.sqrt(252) * 100,
  };
}
