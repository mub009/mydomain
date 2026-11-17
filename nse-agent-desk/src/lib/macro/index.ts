/**
 * Macro Agent: Gold, Brent crude and USD/INR, and the stocks that depend on them.
 *
 * Factor data
 *   live: Yahoo daily bars for gold futures (GC=F, converted to ₹ per 10 g with USD/INR;
 *         excludes import duty and GST), Brent crude futures (BZ=F, $/bbl) and USD/INR (INR=X)
 *   demo: sample series, labelled as such
 *
 * A factor "matters" when its 1-month move is at least: gold 2%, crude 3%, USD/INR 0.7%.
 *
 * For each stock with a known link (see exposure.ts):
 *   effect     Tailwind if the move helps it, Headwind if it hurts, Neutral if the move
 *              is small or the link is mixed
 *   points     2, +1 for a big move (2× the threshold), +1 if the stock's measured
 *              correlation with the factor agrees (|corr| ≥ 0.2), −1 if it disagrees
 * A stock with no known link but |corr| ≥ 0.4 is listed as a "measured" link worth 1 point.
 * The total per stock is capped at ±4 and applied to Research Agent's combined score.
 */
import type { Analysis, Bar, MacroExposure, MacroFactor, MacroReport } from "../types";
import { getProvider } from "../market";
import { weekdays } from "../market/demo";
import { EXPOSURES, demoFactorReturns, type FactorId } from "./exposure";

const META: Record<FactorId, { name: string; unit: string; threshold: number; start: number }> = {
  // `start` is where a demo series ends (today's level), so sample prices stay plausible.
  gold: { name: "Gold", unit: "₹/10g", threshold: 2, start: 95000 },
  crude: { name: "Brent crude", unit: "$/bbl", threshold: 3, start: 75 },
  usdinr: { name: "USD/INR", unit: "₹ per $", threshold: 0.7, start: 86 },
};
const IDS: FactorId[] = ["gold", "crude", "usdinr"];
export type FactorSeries = Record<FactorId, { date: string; close: number }[]>;

/** Gold, crude and USD/INR daily closes. Returns null when live data can't be loaded. */
export async function loadMacro(demo: boolean, seed = 0, days = 260): Promise<{ series: FactorSeries; sample: boolean } | null> {
  if (demo) {
    const dates = weekdays(days), rets = demoFactorReturns(seed, days);
    const series = {} as FactorSeries;
    for (const f of IDS) {
      // Build the path, then scale it so the last close sits at today's typical level.
      let v = 1;
      const path = rets[f].map((r) => (v *= Math.exp(r)));
      const k = (META[f].start * (1 + rets[f][0] * 5)) / path[path.length - 1]; // vary today's level a little per run
      series[f] = path.map((x, i) => ({ date: dates[i], close: Math.round(x * k * 100) / 100 }));
    }
    return { series, sample: true };
  }
  const p = getProvider();
  if (!p) return null;
  try {
    const [gold, crude, fx] = await Promise.all(["GC=F", "BZ=F", "INR=X"].map((s) => p.getDailyBars(s)));
    const fxBy = new Map(fx.map((b: Bar) => [b.date, b.close]));
    let lastFx = fx[0]?.close;
    const goldInr = gold.map((b) => {
      lastFx = fxBy.get(b.date) ?? lastFx;
      return { date: b.date, close: Math.round(((b.close * lastFx) / 31.1035) * 10) }; // troy ounce → 10 g
    });
    return { series: { gold: goldInr, crude: crude.map((b) => ({ date: b.date, close: b.close })), usdinr: fx.map((b) => ({ date: b.date, close: b.close })) }, sample: false };
  } catch (e) {
    console.warn("[nse-agent-desk] macro data unavailable:", (e as Error).message);
    return null;
  }
}

const pctBack = (c: number[], back: number) => (c.length > back ? (c[c.length - 1] / c[c.length - 1 - back] - 1) * 100 : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

export function factorViews(series: FactorSeries, sample: boolean): MacroFactor[] {
  return IDS.filter((f) => series[f]?.length > 25).map((f) => {
    const c = series[f].map((x) => x.close);
    const sma20 = c.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const ret1m = pctBack(c, 21);
    const last = c[c.length - 1];
    return {
      id: f, name: META[f].name, unit: META[f].unit, level: r2(last),
      ret1d: r2(pctBack(c, 1)), ret5d: r2(pctBack(c, 5)), ret1m: r2(ret1m),
      trend: last > sma20 * 1.005 ? "Up" : last < sma20 * 0.995 ? "Down" : "Flat",
      significant: Math.abs(ret1m) >= META[f].threshold, spark: c.slice(-60), sample,
    };
  });
}

/** Correlation of daily returns between a stock and a factor on the dates both traded (last ~120). */
export function measuredCorr(stock: Bar[], factor: { date: string; close: number }[]): number | undefined {
  const fBy = new Map(factor.map((x) => [x.date.slice(0, 10), x.close]));
  const pairs = stock.map((b) => [b.close, fBy.get(b.date.slice(0, 10))] as const).filter((p): p is readonly [number, number] => p[1] !== undefined).slice(-121);
  if (pairs.length < 40) return undefined;
  const a: number[] = [], b: number[] = [];
  for (let i = 1; i < pairs.length; i++) { a.push(pairs[i][0] / pairs[i - 1][0] - 1); b.push(pairs[i][1] / pairs[i - 1][1] - 1); }
  const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < a.length; i++) { cov += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  return va && vb ? r2(cov / Math.sqrt(va * vb)) : undefined;
}

export function analyseMacro(frames: Record<string, Bar[]>, series: FactorSeries, sample: boolean): MacroReport {
  const factors = factorViews(series, sample);
  const byId = new Map(factors.map((f) => [f.id, f]));
  const exposures: MacroExposure[] = [];

  for (const [symbol, bars] of Object.entries(frames)) {
    const known = EXPOSURES[symbol] ?? [];
    for (const f of factors) {
      const corr = measuredCorr(bars, series[f.id]);
      const k = known.find((e) => e.factor === f.id);
      const strong = Math.abs(f.ret1m) >= META[f.id].threshold * 2;
      const up = f.ret1m > 0;
      if (k) {
        let effect: MacroExposure["effect"] = "Neutral", points = 0;
        if (k.link !== "mixed" && f.significant) {
          const helps = (k.link === "benefits") === up;
          const agrees = corr !== undefined && Math.abs(corr) >= 0.2 ? ((corr > 0) === (k.link === "benefits") ? 1 : -1) : 0;
          points = Math.max(1, 2 + (strong ? 1 : 0) + agrees) * (helps ? 1 : -1);
          effect = helps ? "Tailwind" : "Headwind";
        }
        exposures.push({ symbol, factor: f.id, basis: "known", link: k.link, reason: k.reason, corr, effect, points });
      } else if (corr !== undefined && Math.abs(corr) >= 0.4) {
        const link = corr > 0 ? "benefits" : "hurts";
        const helps = (link === "benefits") === up;
        exposures.push({
          symbol, factor: f.id, basis: "measured", link, corr,
          reason: `its daily moves have tracked ${f.name.toLowerCase()} ${corr > 0 ? "closely" : "in reverse"} (correlation ${corr.toFixed(2)})`,
          effect: f.significant ? (helps ? "Tailwind" : "Headwind") : "Neutral", points: f.significant ? (helps ? 1 : -1) : 0,
        });
      }
    }
  }
  exposures.sort((a, b) => Math.abs(b.points) - Math.abs(a.points) || a.symbol.localeCompare(b.symbol));

  const sgn = (n: number) => { const t = n.toFixed(1); return t === "-0.0" || t === "0.0" ? "0.0" : `${n > 0 ? "+" : ""}${t}`; };
  const move = (f: MacroFactor) => `${f.name} ${sgn(f.ret1m)}% over the month${f.significant ? "" : " (small)"}`;
  const tail = new Set(exposures.filter((e) => e.effect === "Tailwind").map((e) => e.symbol)).size;
  const head = new Set(exposures.filter((e) => e.effect === "Headwind").map((e) => e.symbol)).size;
  const g = byId.get("gold");
  const riskOff = g && g.ret1m >= 4 ? " Gold's sharp rise often signals investors seeking safety." : "";
  return {
    factors, exposures, sample,
    summary: `${factors.map(move).join("; ")}. ${tail} stock${tail === 1 ? " has" : "s have"} a tailwind and ${head} a headwind from these moves.${riskOff}`,
  };
}

/** Apply the Macro Agent's points to Research Agent's scores (capped at ±4 per stock). */
export function applyMacro(rows: Analysis[], report: MacroReport | null): Analysis[] {
  if (!report) return rows;
  const by = new Map<string, MacroExposure[]>();
  for (const e of report.exposures) by.set(e.symbol, [...(by.get(e.symbol) ?? []), e]);
  return rows.map((r) => {
    const ex = by.get(r.symbol);
    if (!ex) return r;
    const pts = Math.max(-4, Math.min(4, ex.reduce((s, e) => s + e.points, 0)));
    const active = ex.filter((e) => e.points !== 0);
    const notes = active.length
      ? [...r.notes, `Macro: ${active.map((e) => `${e.effect.toLowerCase()} from ${META[e.factor].name}`).join(", ")} (${pts >= 0 ? "+" : ""}${pts})`]
      : r.notes;
    return { ...r, macro: ex, notes, combined: Math.round(Math.max(0, Math.min(100, r.combined + pts)) * 10) / 10 };
  }).sort((a, b) => b.combined - a.combined);
}

export const factorName = (id: FactorId) => META[id].name;
