/**
 * Research desk: three sub-agents that report to the Research Agent.
 *
 *  Performance Agent  absolute return YTD, annualised 5-year return (CAGR) and
 *                     expected 1-year return
 *  Valuation Agent    TTM P/E (against the sector median), P/B and P/CFO
 *  Growth Agent       3-year CAGR of revenue, operating cash flow and net profit
 *
 * Each view adds or removes a few points; together at most +/-8 on the
 * combined score. They run on the top candidates only, like the chart check.
 *
 * Expected return: with live data it is the analysts' mean 12-month target
 * (Yahoo, when available). Otherwise it is an estimate: earnings growth
 * (3-year EPS CAGR, capped -10% to +25%) plus a valuation term that adds up
 * to +8 when the P/E is below its sector median and takes up to 8 off when it
 * is above. It is a rough guide, not a forecast.
 */
import { loadFinancials, yahooAnalystTarget } from "./company";
import type { YearFinancials } from "./company/types";
import { getProvider } from "./market";
import { demoLongBars } from "./market/demo";
import type { Bar, DataSource, DeskMetric, DeskTone, DeskView, Fundamentals, ResearchDesk } from "./types";

const FINANCIAL = new Set(["Banks", "Financials"]);
const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Compound annual growth in %, or undefined when either end is zero or negative. */
export function cagr(first: number | undefined, last: number | undefined, years: number): number | undefined {
  if (first === undefined || last === undefined || first <= 0 || last <= 0 || years <= 0) return undefined;
  return r1((Math.pow(last / first, 1 / years) - 1) * 100);
}

const tone = (points: number, any: boolean): DeskTone => (!any ? "n/a" : points >= 2 ? "good" : points >= 0 ? "ok" : "weak");

// ---------- Performance Agent ----------

/** Return since the last close of the previous calendar year, in %. */
export function ytdReturn(daily: Bar[]): number | undefined {
  if (!daily.length) return undefined;
  const last = daily[daily.length - 1];
  const jan1 = `${last.date.slice(0, 4)}-01-01`;
  const base = [...daily].reverse().find((b) => b.date < jan1);
  return base ? r1((last.close / base.close - 1) * 100) : undefined;
}

/** Annualised return over about five years from weekly bars, with the span actually covered. */
export function fiveYearCagr(long: Bar[]): { value?: number; years: number } {
  if (long.length < 2) return { years: 0 };
  const last = long[long.length - 1];
  const start = new Date(`${last.date.slice(0, 10)}T00:00:00Z`);
  start.setUTCFullYear(start.getUTCFullYear() - 5);
  const t0 = start.getTime(), at = (b: Bar) => Date.parse(b.date.slice(0, 10));
  const from = long.reduce((best, b) => (Math.abs(at(b) - t0) < Math.abs(at(best) - t0) ? b : best), long[0]); // bar closest to 5 years ago
  const years = (Date.parse(last.date.slice(0, 10)) - Date.parse(from.date.slice(0, 10))) / (365.25 * 86400_000);
  return { value: years >= 4.5 ? cagr(from.close, last.close, years) : undefined, years: r1(years) };
}

export function expectedReturn(o: { price: number; target?: { mean: number; analysts: number } | null; epsCagr?: number; pe?: number; sectorPe?: number }): DeskMetric {
  if (o.target) {
    return { label: "Expected 1Y", unit: "%", value: r1((o.target.mean / o.price - 1) * 100), note: `mean target of ${o.target.analysts} analyst${o.target.analysts === 1 ? "" : "s"}` };
  }
  if (o.epsCagr === undefined) return { label: "Expected 1Y", unit: "%", note: "not enough earnings history" };
  const rerate = o.pe && o.sectorPe ? clamp((o.sectorPe / o.pe - 1) * 10, -8, 8) : 0;
  return { label: "Expected 1Y", unit: "%", value: r1(clamp(o.epsCagr, -10, 25) + rerate), note: "estimate: earnings growth + valuation vs sector" };
}

export function performanceView(o: { ytd?: number; niftyYtd?: number; five: { value?: number; years: number }; expected: DeskMetric }): DeskView {
  let points = 0;
  const reasons: string[] = [];
  if (o.five.value !== undefined) {
    if (o.five.value >= 15) { points += 1; reasons.push(`compounded ${o.five.value}% a year over 5 years`); }
    else if (o.five.value < 0) { points -= 1; reasons.push(`lost ${Math.abs(o.five.value)}% a year over 5 years`); }
    else reasons.push(`${o.five.value}% a year over 5 years`);
  } else if (o.five.years) reasons.push(`only ${o.five.years} years of price history`);
  if (o.ytd !== undefined && o.niftyYtd !== undefined) {
    const rel = r1(o.ytd - o.niftyYtd);
    if (rel >= 5) { points += 1; reasons.push(`ahead of the Nifty by ${rel}% this year`); }
    else if (rel <= -10) { points -= 1; reasons.push(`behind the Nifty by ${Math.abs(rel)}% this year`); }
  }
  const e = o.expected.value;
  if (e !== undefined) {
    if (e >= 15) { points += 1; reasons.push(`expected return ${e}%`); }
    else if (e < 0) { points -= 1; reasons.push(`expected return is negative (${e}%)`); }
  }
  const any = o.ytd !== undefined || o.five.value !== undefined || e !== undefined;
  return {
    agent: "Performance", points, tone: tone(points, any),
    verdict: !any ? "No data" : points >= 2 ? "Outperformer" : points >= 0 ? "Average" : "Laggard",
    metrics: [
      { label: "Return YTD", unit: "%", value: o.ytd, note: o.niftyYtd !== undefined ? `Nifty ${o.niftyYtd >= 0 ? "+" : ""}${o.niftyYtd}%` : undefined },
      { label: "5Y annualised", unit: "%", value: o.five.value, note: o.five.value === undefined && o.five.years ? `${o.five.years} years of data` : "CAGR" },
      o.expected,
    ],
    reasons,
  };
}

// ---------- Valuation Agent ----------

export function valuationView(o: { price: number; f?: Fundamentals; latest?: YearFinancials; sectorPe?: number; financial: boolean }): DeskView {
  const eps = o.f?.epsTTM, mcap = o.f?.marketCapCr;
  const pe = eps !== undefined && eps > 0 ? r1(o.price / eps) : undefined;
  const pb = mcap && o.latest?.equity && o.latest.equity > 0 ? r1(mcap / o.latest.equity) : undefined;
  const cfo = o.latest?.operatingCashFlow;
  const pcfo = !o.financial && mcap && cfo && cfo > 0 ? r1(mcap / cfo) : undefined;
  let points = 0;
  const reasons: string[] = [];
  if (eps !== undefined && eps <= 0) { points -= 1; reasons.push("loss-making, so P/E is not meaningful"); }
  if (pe !== undefined && o.sectorPe) {
    const rel = pe / o.sectorPe;
    if (rel <= 0.8) { points += 2; reasons.push(`P/E ${pe}x is below the sector's ${r1(o.sectorPe)}x`); }
    else if (rel <= 1.2) reasons.push(`P/E ${pe}x is in line with the sector's ${r1(o.sectorPe)}x`);
    else if (rel <= 1.5) { points -= 1; reasons.push(`P/E ${pe}x is above the sector's ${r1(o.sectorPe)}x`); }
    else { points -= 2; reasons.push(`P/E ${pe}x is far above the sector's ${r1(o.sectorPe)}x`); }
  }
  if (pcfo !== undefined && pe !== undefined && pcfo > pe * 1.5) { points -= 1; reasons.push(`P/CFO ${pcfo}x is much higher than P/E: profits are not fully backed by cash`); }
  if (!o.financial && cfo !== undefined && cfo <= 0) { points -= 1; reasons.push("operating cash flow is negative"); }
  if (pb !== undefined && pb < 1) reasons.push(`trades below book value (P/B ${pb}x)`);
  if (o.financial) reasons.push("lender: P/CFO doesn't apply, P/B matters more");
  points = clamp(points, -3, 2);
  const any = pe !== undefined || pb !== undefined || pcfo !== undefined || (eps !== undefined && eps <= 0);
  return {
    agent: "Valuation", points, tone: tone(points + 1, any), // fair value (0 points) reads as OK
    verdict: !any ? "No data" : points >= 1 ? "Attractive" : points === 0 ? "Fair" : points === -1 ? "Rich" : "Expensive",
    metrics: [
      { label: "P/E (TTM)", unit: "x", value: pe, note: pe === undefined && eps !== undefined && eps <= 0 ? "loss-making" : o.sectorPe ? `sector median ${r1(o.sectorPe)}x` : undefined },
      { label: "P/B", unit: "x", value: pb },
      { label: "P/CFO", unit: "x", value: pcfo, note: o.financial ? "not used for lenders" : cfo !== undefined && cfo <= 0 ? "negative cash flow" : undefined },
    ],
    reasons,
  };
}

// ---------- Growth Agent ----------

const fy = (label: string) => { const m = /FY(\d{2})/.exec(label); return m ? Number(m[1]) : undefined; };

export function growthView(years: YearFinancials[], financial: boolean): DeskView {
  const ys = years.filter((y) => y.revenue !== undefined || y.netIncome !== undefined);
  const first = ys[0], last = ys[ys.length - 1];
  const span = first && last ? ((fy(last.year) ?? 0) - (fy(first.year) ?? 0)) || ys.length - 1 : 0;
  const empty = (note: string): DeskView => ({
    agent: "Growth", points: 0, tone: "n/a", verdict: "No data", reasons: [note],
    metrics: [{ label: "Revenue 3Y", unit: "%" }, { label: "Cash flow 3Y", unit: "%" }, { label: "Profit 3Y", unit: "%" }],
  });
  if (span < 2) return empty("fewer than three years of financials");
  const rev = cagr(first.revenue, last.revenue, span);
  const cf = financial ? undefined : cagr(first.operatingCashFlow, last.operatingCashFlow, span);
  const profit = cagr(first.netIncome, last.netIncome, span);
  const reasons: string[] = [];
  const lossNow = last.netIncome !== undefined && last.netIncome <= 0;
  const known = [rev, cf, profit].filter((v): v is number => v !== undefined);
  let points = 0;
  if (lossNow) { points = -2; reasons.push(`loss-making in ${last.year}`); }
  else if (known.length) {
    const avg = known.reduce((a, b) => a + b, 0) / known.length;
    points = avg >= 15 ? 3 : avg >= 10 ? 2 : avg >= 5 ? 1 : avg >= 0 ? 0 : -2;
    reasons.push(`average ${r1(avg)}% a year across ${known.length === 3 ? "revenue, cash flow and profit" : `${known.length} measures`}`);
    if (rev !== undefined && profit !== undefined && profit > rev + 5) reasons.push("profit grew faster than revenue: margins improved");
    if (cf !== undefined && profit !== undefined && cf < profit - 10) reasons.push("cash flow lagged profit growth");
  }
  if (financial) reasons.push("lender: cash-flow growth not used");
  const label = `${span}Y`;
  return {
    agent: "Growth", points, tone: tone(points, known.length > 0 || lossNow),
    verdict: lossNow ? "Loss-making" : !known.length ? "No data" : points >= 3 ? "High growth" : points >= 1 ? "Steady growth" : points === 0 ? "Slow growth" : "Shrinking",
    metrics: [
      { label: `Revenue ${label}`, unit: "%", value: rev, note: "CAGR" },
      { label: `Cash flow ${label}`, unit: "%", value: cf, note: financial ? "not used for lenders" : "operating, CAGR" },
      { label: `Profit ${label}`, unit: "%", value: profit, note: lossNow ? "loss in latest year" : "net, CAGR" },
    ],
    reasons,
  };
}

// ---------- the desk ----------

export interface DeskContext {
  frames: Record<string, Bar[]>;
  funds: Record<string, Fundamentals>;
  source: DataSource;
  indexClose: number[];
  sectorOf: (s: string) => string;
}

/** Median TTM P/E per sector from every profitable stock in this run (sectors with fewer than 3 use the overall median). */
export function sectorPes(ctx: Pick<DeskContext, "frames" | "funds" | "sectorOf">): Record<string, number> {
  const by: Record<string, number[]> = {};
  const all: number[] = [];
  for (const [s, bars] of Object.entries(ctx.frames)) {
    const eps = ctx.funds[s]?.epsTTM;
    if (eps === undefined || eps <= 0) continue;
    const pe = bars[bars.length - 1].close / eps;
    (by[ctx.sectorOf(s)] ??= []).push(pe); all.push(pe);
  }
  const overall = median(all);
  const out: Record<string, number> = {};
  for (const s of Object.keys(ctx.frames)) {
    const list = by[ctx.sectorOf(s)] ?? [];
    const m = list.length >= 3 ? median(list) : overall;
    if (m) out[s] = m;
  }
  return out;
}

/** Nifty 50 return this calendar year, aligned on a stock's dated bars. */
function niftyYtd(indexClose: number[], ref?: Bar[]): number | undefined {
  if (!ref?.length || indexClose.length < 2) return undefined;
  const jan1 = `${ref[ref.length - 1].date.slice(0, 4)}-01-01`;
  const n = ref.filter((b) => b.date >= jan1).length;
  const base = indexClose[indexClose.length - 1 - n];
  return n && base ? r1((indexClose[indexClose.length - 1] / base - 1) * 100) : undefined;
}

export async function runResearchDesk(symbols: string[], ctx: DeskContext): Promise<Record<string, ResearchDesk>> {
  const demo = ctx.source.kind === "demo", seed = ctx.source.seed ?? 0;
  const price = (s: string) => ctx.frames[s][ctx.frames[s].length - 1].close;
  const pes = sectorPes(ctx);
  const nifty = niftyYtd(ctx.indexClose, ctx.frames[symbols[0]]);
  const provider = demo ? null : getProvider();
  const [fin, longs, targets] = await Promise.all([
    loadFinancials(Object.fromEntries(symbols.map((s) => [s, price(s)])), { demo, seed }),
    Promise.all(symbols.map(async (s) => (demo ? demoLongBars(ctx.frames[s], s, seed) : await provider?.getLongBars(s).catch(() => []) ?? []))),
    Promise.all(symbols.map((s) => (demo ? Promise.resolve(null) : yahooAnalystTarget(s)))),
  ]);
  const out: Record<string, ResearchDesk> = {};
  symbols.forEach((s, i) => {
    const years = fin[s] ?? [];
    const financial = FINANCIAL.has(ctx.sectorOf(s));
    const f = ctx.funds[s];
    const growth = growthView(years, financial);
    const epsHist = f?.epsHistory ?? [];
    const epsCagr = epsHist.length >= 2 ? cagr(epsHist[0].eps, epsHist[epsHist.length - 1].eps, epsHist.length - 1) ?? f?.epsGrowth1y : f?.epsGrowth1y;
    const valuation = valuationView({ price: price(s), f, latest: years[years.length - 1], sectorPe: pes[s], financial });
    const pe = valuation.metrics[0].value;
    const performance = performanceView({
      ytd: ytdReturn(ctx.frames[s]), niftyYtd: nifty, five: fiveYearCagr(longs[i]),
      expected: expectedReturn({ price: price(s), target: targets[i], epsCagr, pe, sectorPe: pes[s] }),
    });
    out[s] = {
      performance, valuation, growth,
      points: clamp(performance.points + valuation.points + growth.points, -8, 8),
      sample: demo, source: demo ? "Sample figures (demo)" : "Yahoo Finance (unofficial)",
    };
  });
  return out;
}
