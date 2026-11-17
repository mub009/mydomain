/**
 * Research desk: three sub-agents that report to the Research Agent.
 *
 *  Performance Agent  absolute return YTD, annualised 5-year return (CAGR) and
 *                     expected 1-year return
 *  Valuation Agent    TTM P/E (against the sector median), P/B and P/CFO
 *  Growth Agent       3-year CAGR of revenue, operating cash flow and net profit
 *
 *  Profitability Agent ROE, net margin, cash conversion (operating cash / profit)
 *  Red Flag Agent     ASM / GSM surveillance, promoter pledge, unsolicited-tip
 *                     alerts or pump-like patterns, default probability
 *  Entry Point Agent  fundamentals (valuation, growth, profitability) plus
 *                     technicals (chart check, buy zone) give one entry call
 *
 * The first four together move the combined score by at most +/-10, red flags
 * take up to 10 more off, and the entry call adds +/-2. A severe red flag
 * stops the Decision Agent from rating the stock above WATCH. They run on the
 * top candidates only, like the chart check.
 *
 * Expected return: with live data it is the analysts' mean 12-month target
 * (Yahoo, when available). Otherwise it is an estimate: earnings growth
 * (3-year EPS CAGR, capped -10% to +25%) plus a valuation term that adds up
 * to +8 when the P/E is below its sector median and takes up to 8 off when it
 * is above. It is a rough guide, not a forecast.
 */
import { demoShareholding, loadFinancials, yahooAnalystTarget } from "./company";
import { computeRatios } from "./company/quality";
import { loadSurveillance, type Surveillance } from "./surveillance";
import type { YearFinancials } from "./company/types";
import { getProvider } from "./market";
import { demoLongBars } from "./market/demo";
import type { Analysis, Bar, DataSource, DeskMetric, DeskTone, DeskView, EntryPlan, Fundamentals, RedFlag, ResearchDesk } from "./types";

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

// ---------- Profitability Agent ----------

export function profitabilityView(years: YearFinancials[], financial: boolean): DeskView {
  const last = years[years.length - 1];
  const ratios = computeRatios(years);
  const margin = last?.netIncome !== undefined && last.revenue ? r1((last.netIncome / last.revenue) * 100) : undefined;
  const profitYears = years.filter((y) => y.netIncome !== undefined);
  const inProfit = profitYears.filter((y) => y.netIncome! > 0).length;
  const conv = financial ? undefined : ratios.cashConversion;
  let points = 0;
  const reasons: string[] = [];
  const roe = ratios.roe;
  if (last?.netIncome !== undefined && last.netIncome <= 0) { points -= 2; reasons.push(`loss-making in ${last.year}`); }
  else if (roe !== undefined) {
    if (roe >= 20) { points += 2; reasons.push(`ROE ${r1(roe)}%: earns very well on shareholders' money`); }
    else if (roe >= 15) { points += 1; reasons.push(`ROE ${r1(roe)}% is good`); }
    else if (roe < 8) { points -= 1; reasons.push(`ROE ${r1(roe)}% is low`); }
    else reasons.push(`ROE ${r1(roe)}% is average`);
  }
  if (profitYears.length >= 3 && inProfit < profitYears.length && !(last?.netIncome !== undefined && last.netIncome <= 0)) { points -= 1; reasons.push(`made a loss in ${profitYears.length - inProfit} of the last ${profitYears.length} years`); }
  if (conv !== undefined) {
    if (conv >= 1) { points += 1; reasons.push(`cash flow covers ${conv.toFixed(2)}x of profit`); }
    else if (conv < 0.7) { points -= 1; reasons.push(`only ${Math.round(conv * 100)}% of profit came in as cash`); }
  }
  if (financial) reasons.push("lender: cash conversion not used");
  points = clamp(points, -3, 3);
  const any = roe !== undefined || margin !== undefined;
  return {
    agent: "Profitability", points, tone: tone(points, any),
    verdict: !any ? "No data" : points >= 2 ? "Highly profitable" : points >= 0 ? "Profitable" : "Weak profits",
    metrics: [
      { label: "ROE", unit: "%", value: roe === undefined ? undefined : r1(roe), note: "latest year" },
      { label: "Net margin", unit: "%", value: margin, note: profitYears.length ? `profit in ${inProfit} of ${profitYears.length} years` : undefined },
      { label: "Cash / profit", unit: "x", value: conv, note: financial ? "not used for lenders" : "3-year operating cash ÷ profit" },
    ],
    reasons,
  };
}

// ---------- Red Flag Agent ----------

/** Standard normal CDF (Abramowitz-Stegun). */
function phi(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/**
 * One-year default probability from the "naive" Merton distance-to-default
 * (Bharath & Shumway, 2008): equity value and volatility from the market,
 * debt from the balance sheet, last year's return as the drift.
 */
export function defaultProbability(o: { marketCapCr: number; debtCr: number; equityVol: number; ret1y: number }): number {
  const E = o.marketCapCr, D = o.debtCr;
  if (D <= 0) return 0;
  const sE = Math.max(o.equityVol, 0.05), sD = 0.05 + 0.25 * sE;
  const V = E + D, sV = (E / V) * sE + (D / V) * sD;
  const mu = clamp(o.ret1y, -0.9, 1);
  const dd = (Math.log(V / D) + (mu - 0.5 * sV * sV)) / sV;
  return Math.round(phi(-dd) * 10000) / 100; // %
}

/** Price/volume pattern of a tip-driven pump: a sharp run-up on heavy volume in a smaller stock. */
export function pumpPattern(daily: Bar[], cap?: string): string | null {
  if (daily.length < 30 || cap === "Large") return null;
  const n = daily.length, close = daily[n - 1].close;
  const ret10 = (close / daily[n - 11].close - 1) * 100;
  const avgVol = daily.slice(n - 30, n - 10).reduce((s, b) => s + b.volume, 0) / 20;
  const recentVol = daily.slice(n - 10).reduce((s, b) => s + b.volume, 0) / 10;
  const volX = avgVol > 0 ? recentVol / avgVol : 0;
  return ret10 >= 25 && volX >= 3 ? `up ${r1(ret10)}% in 10 days on ${r1(volX)}x normal volume` : null;
}

const SEVERE_ASM = /LT\s*Stage\s*(II|III|IV)/i;

export function redFlagView(o: {
  symbol: string; surv: Surveillance; pledgePct?: number; pd?: number; financial: boolean; pump: string | null;
}): DeskView {
  const flags: RedFlag[] = [];
  const { surv, symbol } = o;
  const gsm = surv.gsm[symbol], asm = surv.asm[symbol];
  flags.push(gsm ? { check: "GSM", status: "severe", detail: `In GSM ${gsm}: graded surveillance, usually for weak fundamentals or price manipulation risk` }
    : surv.checked.gsm ? { check: "GSM", status: "clear", detail: "Not in the GSM list" } : { check: "GSM", status: "unknown", detail: "GSM list not checked: see NSE surveillance" });
  flags.push(asm ? { check: "ASM", status: SEVERE_ASM.test(asm) ? "severe" : "warning", detail: `In ASM ${asm}: extra margins because of unusual price moves` }
    : surv.checked.asm ? { check: "ASM", status: "clear", detail: "Not in the ASM list" } : { check: "ASM", status: "unknown", detail: "ASM list not checked: see NSE surveillance" });
  const pl = o.pledgePct;
  flags.push(pl === undefined ? { check: "Promoter pledge", status: "unknown", detail: "Pledge data not available: check the NSE shareholding page" }
    : pl > 50 ? { check: "Promoter pledge", status: "severe", detail: `${r1(pl)}% of promoter shares pledged: a price fall can force sales` }
    : pl > 10 ? { check: "Promoter pledge", status: "warning", detail: `${r1(pl)}% of promoter shares pledged` }
    : { check: "Promoter pledge", status: "clear", detail: pl > 0 ? `${r1(pl)}% pledged (low)` : "No promoter shares pledged" });
  const listed = surv.unsolicited.includes(symbol);
  flags.push(listed ? { check: "Unsolicited tips", status: "severe", detail: "Named in an exchange alert about unsolicited SMS/WhatsApp tips" }
    : o.pump ? { check: "Unsolicited tips", status: "warning", detail: `Pump-like pattern: ${o.pump}. Be wary of tips about this stock` }
    : { check: "Unsolicited tips", status: "clear", detail: surv.checked.unsolicited ? "Not in the alert list; no pump-like pattern" : "No pump-like price pattern (exchange alert list not checked)" });
  flags.push(o.financial ? { check: "Default risk", status: "unknown", detail: "Not modelled for banks and NBFCs (their debt is deposits and borrowings they lend on)" }
    : o.pd === undefined ? { check: "Default risk", status: "unknown", detail: "Debt or market cap not available" }
    : o.pd > 5 ? { check: "Default risk", status: "severe", detail: `Estimated 1-year default probability ${o.pd}%: debt is high against a volatile share price` }
    : o.pd > 1 ? { check: "Default risk", status: "warning", detail: `Estimated 1-year default probability ${o.pd}%` }
    : { check: "Default risk", status: "clear", detail: `Estimated 1-year default probability ${o.pd < 0.01 ? "below 0.01" : o.pd}%` });
  const severe = flags.filter((f) => f.status === "severe").length, warn = flags.filter((f) => f.status === "warning").length;
  const points = severe || warn ? Math.max(-10, -4 * severe - warn) : 0;
  return {
    agent: "RedFlag", points, tone: severe ? "weak" : warn ? "ok" : "good",
    verdict: severe ? `${severe} red flag${severe > 1 ? "s" : ""}` : warn ? "Caution" : "Clear",
    metrics: [
      { label: "Red flags", unit: "", value: severe, note: warn ? `${warn} warning${warn > 1 ? "s" : ""}` : "no warnings" },
      { label: "Pledged", unit: "%", value: pl, note: "of promoter shares" },
      { label: "Default prob.", unit: "%", value: o.financial ? undefined : o.pd, note: o.financial ? "not for lenders" : "1 year, Merton model" },
    ],
    reasons: flags.filter((f) => f.status === "severe" || f.status === "warning").map((f) => f.detail),
    flags,
  };
}

// ---------- Entry Point Agent ----------

/** Fundamentals from the desk plus technicals from the chart check give one entry call. */
export function entryView(r: Analysis): DeskView | undefined {
  const d = r.desk, c = r.chart;
  if (!d || !c) return undefined;
  const fPts = d.valuation.points + d.growth.points + d.profitability.points;
  const fund = fPts >= 3 ? "Strong" : fPts >= 0 ? "OK" : "Weak";
  const tPts = c.bullish - c.bearish;
  const tech = tPts >= 2 && r.rsi < 72 ? "Positive" : tPts <= -2 ? "Negative" : "Mixed";
  const z = c.zone;
  let plan: EntryPlan;
  const reasons = [`fundamentals ${fund.toLowerCase()} (valuation, growth, profitability ${fPts >= 0 ? "+" : ""}${fPts})`, `technicals ${tech.toLowerCase()} (${c.bullish} of 5 timeframes bullish, RSI ${Math.round(r.rsi)})`];
  if (d.severe) { plan = "Avoid"; reasons.push("a red flag rules out a new entry"); }
  else if (fund === "Weak" && tech === "Negative") { plan = "Avoid"; reasons.push("weak business and a falling chart"); }
  else if (!z) { plan = "Wait"; reasons.push("no reliable buy zone below the price yet"); }
  else if (z.plan === "In buy zone" && tech !== "Negative" && fund !== "Weak") { plan = "Buy now"; reasons.push(`price is inside the buy zone ₹${Math.round(z.low)}-₹${Math.round(z.high)}`); }
  else if (fund !== "Weak") { plan = "Buy on dip"; reasons.push(`wait for ₹${Math.round(z.low)}-₹${Math.round(z.high)}, ${z.distancePct.toFixed(1)}% below today`); }
  else { plan = "Wait"; reasons.push("weak fundamentals: only on a deeper dip, if at all"); }
  if (r.rsi >= 75 && plan === "Buy now") { plan = "Buy on dip"; reasons.push("RSI is stretched"); }
  const points = { "Buy now": 2, "Buy on dip": 1, Wait: 0, Avoid: -2 }[plan];
  return {
    agent: "Entry", points, tone: plan === "Buy now" ? "good" : plan === "Avoid" ? "weak" : "ok", verdict: plan,
    metrics: [
      { label: "Fundamentals", unit: "pts", value: fPts, note: fund },
      { label: "Technicals", unit: "pts", value: tPts, note: tech },
      { label: "To buy zone", unit: "%", value: z ? -z.distancePct : undefined, note: z ? `₹${Math.round(z.low)}-₹${Math.round(z.high)}` : "no zone" },
    ],
    reasons,
    entry: { plan, low: z?.low, high: z?.high },
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
  const demoPledge = demo ? Object.fromEntries(symbols.map((s) => [s, demoShareholding(s, seed).pledgedPct ?? 0])) : undefined;
  const [fin, longs, targets, surv] = await Promise.all([
    loadFinancials(Object.fromEntries(symbols.map((s) => [s, price(s)])), { demo, seed }),
    Promise.all(symbols.map(async (s) => (demo ? demoLongBars(ctx.frames[s], s, seed) : await provider?.getLongBars(s).catch(() => []) ?? []))),
    Promise.all(symbols.map((s) => (demo ? Promise.resolve(null) : yahooAnalystTarget(s)))),
    loadSurveillance(symbols, { demo, seed, demoPledge }),
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
    const profitability = profitabilityView(years, financial);
    const bars = ctx.frames[s], latest = years[years.length - 1];
    const rets = bars.slice(1).map((b, k) => Math.log(b.close / bars[k].close));
    const mean = rets.reduce((a, b) => a + b, 0) / Math.max(1, rets.length);
    const vol = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1)) * Math.sqrt(252);
    const pd = !financial && f?.marketCapCr && latest?.debt !== undefined
      ? defaultProbability({ marketCapCr: f.marketCapCr, debtCr: latest.debt, equityVol: vol, ret1y: bars[bars.length - 1].close / bars[0].close - 1 }) : undefined;
    const redFlags = redFlagView({ symbol: s, surv, pledgePct: surv.pledge[s], pd, financial, pump: pumpPattern(bars, f?.cap) });
    const core = clamp(performance.points + valuation.points + growth.points + profitability.points, -10, 10);
    out[s] = {
      performance, valuation, growth, profitability, redFlags,
      points: core + redFlags.points,
      severe: redFlags.flags!.some((x) => x.status === "severe"),
      sample: demo, source: demo ? "Sample figures (demo)" : `Yahoo Finance (unofficial); surveillance: ${surv.source}`,
    };
  });
  return out;
}
