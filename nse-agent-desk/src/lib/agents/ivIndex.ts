/**
 * IV Index agent: tracks India VIX (the market's expected volatility).
 * When VIX moves it lists the likely drivers it can see in the data, and
 * names the stocks it expects to move next.
 *
 * The "why" is an inference from prices and headlines. Events that are not in
 * the data (results, RBI policy, expiry, global cues) can also move VIX.
 */
import type { Bar, NewsBrief, Snapshot, VixMover, VixReport } from "../types";

const pctChange = (v: number[], back: number) => (v.length > back ? (v[v.length - 1] / v[v.length - 1 - back] - 1) * 100 : 0);
const rets = (v: number[], n: number) => v.slice(-n - 1).map((x, i, a) => (i ? x / a[i - 1] - 1 : 0)).slice(1);

/** How strongly a stock moves with the index (60-day beta). */
function beta(stock: number[], index: number[]): number {
  const n = Math.min(60, stock.length - 1, index.length - 1);
  if (n < 20) return 1;
  const s = rets(stock, n), m = rets(index, n);
  const ms = s.reduce((a, b) => a + b, 0) / n, mm = m.reduce((a, b) => a + b, 0) / n;
  let cov = 0, varM = 0;
  for (let i = 0; i < n; i++) { cov += (s[i] - ms) * (m[i] - mm); varM += (m[i] - mm) ** 2; }
  return varM ? cov / varM : 1;
}

export class IVIndex {
  analyse(vix: number[], index: number[], frames: Record<string, Bar[]>, snaps: Record<string, Snapshot>,
    news: NewsBrief | null, sample: boolean): VixReport | null {
    if (vix.length < 25) return null;
    const level = vix[vix.length - 1];
    const change1d = pctChange(vix, 1), change5d = pctChange(vix, 5);
    const direction: VixReport["direction"] = change1d >= 3 || change5d >= 8 ? "up" : change1d <= -3 || change5d <= -8 ? "down" : "flat";
    const regime: VixReport["regime"] = level < 13 ? "Calm" : level < 18 ? "Normal" : level < 24 ? "Elevated" : "Fear";

    // ---- likely drivers ----
    const reasons: string[] = [];
    const idx1 = pctChange(index, 1), idx5 = pctChange(index, 5);
    const syms = Object.keys(snaps);
    const down = syms.filter((s) => snaps[s].ret1d < 0).length;
    const breadth = syms.length ? (down / syms.length) * 100 : 50;
    const sgn = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

    if (direction === "up") {
      if (idx1 < -0.3 || idx5 < -1) reasons.push(`Nifty is ${sgn(idx1)} today and ${sgn(idx5)} over 5 days. Falling prices make traders pay more for protection, which lifts VIX.`);
      else reasons.push(`Nifty is ${sgn(idx1)} today, so VIX is rising without a price fall. That usually means traders are hedging ahead of an event.`);
      if (breadth >= 60) reasons.push(`${breadth.toFixed(0)}% of the scanned stocks fell today, so the selling is broad.`);
    } else if (direction === "down") {
      if (idx1 > 0.3 || idx5 > 1) reasons.push(`Nifty is ${sgn(idx1)} today and ${sgn(idx5)} over 5 days. Rising, steady prices reduce demand for protection, which lowers VIX.`);
      else reasons.push(`Nifty is ${sgn(idx1)} today. VIX is easing because recent swings have been smaller than traders had priced in.`);
      if (breadth <= 40) reasons.push(`${(100 - breadth).toFixed(0)}% of the scanned stocks rose today, so buying is broad.`);
    } else {
      reasons.push(`VIX is steady (${sgn(change1d)} today), with Nifty ${sgn(idx1)}. No sign of new fear or relief.`);
    }
    const avg20 = vix.slice(-20).reduce((a, b) => a + b, 0) / 20;
    if (Math.abs(level / avg20 - 1) > 0.1) reasons.push(`At ${level.toFixed(1)}, VIX is ${level > avg20 ? "above" : "below"} its 20-day average of ${avg20.toFixed(1)}; it tends to drift back towards it.`);
    if (news) {
      const pos = news.items.filter((i) => i.sentiment === "positive").length, neg = news.items.filter((i) => i.sentiment === "negative").length;
      if (direction === "up" && neg > pos) reasons.push(`News flow is negative: ${neg} negative against ${pos} positive stock headlines.`);
      if (direction === "down" && pos > neg) reasons.push(`News flow is supportive: ${pos} positive against ${neg} negative stock headlines.`);
    }

    // ---- which stocks move next ----
    const stats = syms.map((s) => ({ s, b: beta(frames[s].map((x) => x.close), index), snap: snaps[s] }));
    const hiBeta = [...stats].sort((a, b) => b.b - a.b);
    const loBeta = [...stats].sort((a, b) => a.b - b.b);
    const movers: VixMover[] = [];
    const bx = (b: number) => (b < 0.05 ? "tends to move against the index" : `moves ${b.toFixed(1)}x the index`);
    if (direction === "up") {
      for (const x of hiBeta.filter((x) => x.snap.ret5d < 0).slice(0, 3)) movers.push({ symbol: x.s, expect: "At risk", why: `High beta (${bx(x.b)}) and already ${sgn(x.snap.ret5d)} in 5 days` });
      for (const x of loBeta.filter((x) => x.b < 0.8 && x.snap.close > x.snap.sma50).slice(0, 2)) movers.push({ symbol: x.s, expect: "Holds up", why: `Low beta (${bx(x.b)}) and above its 50-day average` });
    } else if (direction === "down") {
      for (const x of hiBeta.filter((x) => x.snap.ret5d > 0 && x.snap.ema9 > x.snap.ema21).slice(0, 4)) movers.push({ symbol: x.s, expect: "Likely up", why: `High beta (${bx(x.b)}) with momentum, ${sgn(x.snap.ret5d)} in 5 days` });
    }
    if (movers.length < 3) {
      const have = new Set(movers.map((m) => m.symbol));
      for (const x of [...stats].filter((x) => !have.has(x.s)).sort((a, b) => b.snap.atrPct * b.snap.volRatio - a.snap.atrPct * a.snap.volRatio).slice(0, 4 - movers.length)) {
        movers.push({ symbol: x.s, expect: "Bigger swings", why: `Daily range ${x.snap.atrPct.toFixed(1)}% of price, volume ${x.snap.volRatio.toFixed(1)}x normal` });
      }
    }

    const r2 = (n: number) => Math.round(n * 100) / 100;
    return { level: r2(level), change1d: r2(change1d), change5d: r2(change5d), direction, regime, reasons, movers, spark: vix.slice(-60), sample };
  }
}
