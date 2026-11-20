/**
 * Seasonality Agent (research desk): when in the year a stock tends to rise,
 * which quarters its revenue and profit peak, and how its dividends behave.
 *
 *  Price seasonality  For each calendar month, the stock's return in that
 *                     month over up to 10 years: average and how many years it
 *                     rose. The window that matters is this month and next.
 *  Results seasonality Revenue and net profit by fiscal quarter (Q1 = Apr-Jun)
 *                     against the average quarter. Yahoo gives only the last
 *                     ~5 quarters, so this is a light check.
 *  Dividends          Each ex-date in the history: amount, yield, the price
 *                     move on the ex-date (the price normally drops by about the
 *                     dividend), and how many trading days it took to get back to
 *                     the pre-dividend close. The next ex-date is estimated from
 *                     last year's months.
 *
 * Points (at most +/-3): +2 when this month and next rose in at least 70% of
 * years by 2% or more on average, +1 at 60% and positive, -1 at 45% or less,
 * -2 at 35% or less and negative (needs 5+ years); +1 / -1 when the coming
 * quarter's revenue is usually 5% above / below the average quarter; +1 for a
 * dividend yield of 2% or more.
 */
import { yahooTimeseries } from "./market/yahoo-timeseries";
import { dividendAmount, nseCorporateActions, nseMcpEnabled } from "./nse-mcp/client";
import type { Bar, DeskView } from "./types";

export interface Dividend { date: string; amount: number }
export interface QuarterResult { date: string; revenue?: number; profit?: number }
export interface SeasonalData { daily: Bar[]; dividends: Dividend[]; quarters: QuarterResult[]; sample: boolean; dividendSource?: string }

export interface MonthStat { month: number; avg: number; hit: number; years: number }
export interface QuarterStat { q: 1 | 2 | 3 | 4; label: string; revenueVsAvg?: number; profitVsAvg?: number; count: number }
export interface DividendEvent { date: string; amount: number; yieldPct: number; exDayChangePct: number; dropVsDividend: number; recoveryDays?: number }
export interface SeasonalDetail {
  months: MonthStat[];
  window: number[]; // months (1-12) the call is about: this month and next
  quarters: QuarterStat[];
  dividends: DividendEvent[];
  annualDividend: number;
  yieldPct?: number;
  avgExDayChangePct?: number;
  avgRecoveryDays?: number;
  nextEx?: { month: string; amount: number; basedOn: string };
  years: number;
  dividendSource?: string;
}

export const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const QUARTER_LABEL = { 1: "Q1 Apr-Jun", 2: "Q2 Jul-Sep", 3: "Q3 Oct-Dec", 4: "Q4 Jan-Mar" } as const;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/** Monthly returns by calendar month from daily bars (month-end closes). */
export function monthStats(daily: Bar[]): { months: MonthStat[]; years: number } {
  const ends = new Map<string, number>(); // "YYYY-MM" -> last close
  for (const b of daily) ends.set(b.date.slice(0, 7), b.close);
  const keys = [...ends.keys()].sort();
  const by: number[][] = Array.from({ length: 12 }, () => []);
  for (let i = 1; i < keys.length; i++) {
    const [y, m] = keys[i].split("-").map(Number), [py, pm] = keys[i - 1].split("-").map(Number);
    if (y * 12 + m - (py * 12 + pm) !== 1) continue; // need consecutive months
    if (i === keys.length - 1) continue; // the current month is not finished
    by[m - 1].push((ends.get(keys[i])! / ends.get(keys[i - 1])! - 1) * 100);
  }
  const months = by.map((rs, i) => ({ month: i + 1, avg: rs.length ? r1(avg(rs)) : 0, hit: rs.length ? Math.round((rs.filter((x) => x > 0).length / rs.length) * 100) : 0, years: rs.length }));
  return { months, years: Math.max(0, ...months.map((m) => m.years)) };
}

/** Indian fiscal quarter of a quarter-end date: Jun = Q1, Sep = Q2, Dec = Q3, Mar = Q4. */
const fq = (date: string): 1 | 2 | 3 | 4 => ({ 6: 1, 9: 2, 12: 3, 3: 4 } as Record<number, 1 | 2 | 3 | 4>)[Number(date.slice(5, 7))] ?? 1;

export function quarterStats(qs: QuarterResult[]): QuarterStat[] {
  const rev = qs.filter((q) => q.revenue !== undefined), prof = qs.filter((q) => q.profit !== undefined && q.profit > 0);
  const mr = avg(rev.map((q) => q.revenue!)), mp = avg(prof.map((q) => q.profit!));
  return ([1, 2, 3, 4] as const).map((q) => {
    const r = rev.filter((x) => fq(x.date) === q).map((x) => x.revenue!), p = prof.filter((x) => fq(x.date) === q).map((x) => x.profit!);
    return { q, label: QUARTER_LABEL[q], count: Math.max(r.length, p.length),
      revenueVsAvg: r.length && mr ? r1((avg(r) / mr - 1) * 100) : undefined, profitVsAvg: p.length && mp ? r1((avg(p) / mp - 1) * 100) : undefined };
  });
}

/** Every dividend with the ex-date price move and the days to recover the pre-dividend close. */
export function dividendEvents(daily: Bar[], dividends: Dividend[]): DividendEvent[] {
  const idx = new Map(daily.map((b, i) => [b.date, i]));
  const out: DividendEvent[] = [];
  for (const d of dividends) {
    let i = idx.get(d.date);
    if (i === undefined) i = daily.findIndex((b) => b.date >= d.date); // ex-date on a holiday: next session
    if (i === undefined || i < 1) continue;
    const cum = daily[i - 1].close, ex = daily[i];
    let recoveryDays: number | undefined;
    for (let k = i; k < Math.min(daily.length, i + 61); k++) if (daily[k].close >= cum) { recoveryDays = k - i; break; }
    out.push({
      date: ex.date, amount: d.amount, yieldPct: r2((d.amount / cum) * 100),
      exDayChangePct: r2((ex.close / cum - 1) * 100),
      dropVsDividend: Math.round(((cum - ex.open) / d.amount) * 100) / 100,
      recoveryDays,
    });
  }
  return out.reverse(); // newest first
}

export function seasonalView(data: SeasonalData, price: number): DeskView & { seasonalDetail: SeasonalDetail } {
  const { months, years } = monthStats(data.daily);
  const last = data.daily[data.daily.length - 1]?.date ?? new Date().toISOString().slice(0, 10);
  const thisM = Number(last.slice(5, 7)), nextM = (thisM % 12) + 1;
  const window = [thisM, nextM];
  const w = window.map((m) => months[m - 1]);
  const wHit = avg(w.map((x) => x.hit)), wAvg = avg(w.map((x) => x.avg));
  const quarters = quarterStats(data.quarters);
  const events = dividendEvents(data.daily, data.dividends);
  const yearAgo = `${Number(last.slice(0, 4)) - 1}${last.slice(4)}`;
  const ttm = data.dividends.filter((d) => d.date > yearAgo && d.date <= last);
  const annualDividend = Math.round(ttm.reduce((a, d) => a + d.amount, 0) * 100) / 100;
  const yieldPct = price > 0 && annualDividend > 0 ? r2((annualDividend / price) * 100) : undefined;
  const recent = events.slice(0, 8);
  const rec = recent.filter((e) => e.recoveryDays !== undefined).map((e) => e.recoveryDays!);
  // Next ex-date: the first month after today in which last year's dividends were paid.
  const lastYear = data.dividends.filter((d) => d.date > `${Number(last.slice(0, 4)) - 1}-${last.slice(5, 7)}` && d.date <= last);
  // months ahead of today: a date earlier in this month counts as a year away
  const ahead = (d: Dividend) => { const m = Number(d.date.slice(5, 7)); return (m - thisM + 12) % 12 || (d.date.slice(8) > last.slice(8) ? 0 : 12); };
  const nextBase = [...lastYear].sort((a, b) => ahead(a) - ahead(b))[0];
  const nextEx = nextBase ? (() => {
    const m = Number(nextBase.date.slice(5, 7)), y = Number(last.slice(0, 4)) + (thisM + ahead(nextBase) > 12 ? 1 : 0);
    return { month: `${MONTH[m - 1]} ${y}`, amount: nextBase.amount, basedOn: nextBase.date };
  })() : undefined;

  let points = 0;
  const reasons: string[] = [];
  if (years >= 5) {
    const label = `${MONTH[thisM - 1]}-${MONTH[nextM - 1]}`;
    if (wHit >= 70 && wAvg >= 2) { points += 2; reasons.push(`${label} is a strong season: up in ${Math.round(wHit)}% of years, ${r1(wAvg)}% on average`); }
    else if (wHit >= 60 && wAvg > 0) { points += 1; reasons.push(`${label} usually positive: up in ${Math.round(wHit)}% of years`); }
    else if (wHit <= 35 && wAvg < 0) { points -= 2; reasons.push(`${label} is a weak season: up in only ${Math.round(wHit)}% of years, ${r1(wAvg)}% on average`); }
    else if (wHit <= 45) { points -= 1; reasons.push(`${label} is often weak: up in ${Math.round(wHit)}% of years`); }
    else reasons.push(`${label} has no clear seasonal pattern (up in ${Math.round(wHit)}% of years)`);
    const best = [...months].sort((a, b) => b.avg - a.avg)[0];
    reasons.push(`best month historically ${MONTH[best.month - 1]} (${best.avg >= 0 ? "+" : ""}${best.avg}%, up ${best.hit}% of years)`);
  } else reasons.push(`only ${years} years of monthly history, too short for a seasonal call`);
  // the quarter whose results come next: results arrive ~1-2 months after the quarter ends
  // Jan-Feb: Oct-Dec results; Mar-May: Jan-Mar; Jun-Aug: Apr-Jun; Sep-Oct: Jul-Sep; Nov-Dec: Oct-Dec
  const comingQ = fq(`2000-${String([12, 12, 3, 3, 3, 6, 6, 6, 9, 9, 12, 12][thisM - 1]).padStart(2, "0")}-30`);
  const cq = quarters.find((q) => q.q === comingQ);
  if (cq?.revenueVsAvg !== undefined) {
    if (cq.revenueVsAvg >= 5) { points += 1; reasons.push(`next results (${cq.label}) are usually a strong quarter: revenue ${cq.revenueVsAvg}% above average`); }
    else if (cq.revenueVsAvg <= -5) { points -= 1; reasons.push(`next results (${cq.label}) are usually a weak quarter: revenue ${Math.abs(cq.revenueVsAvg)}% below average`); }
  }
  if (yieldPct !== undefined && yieldPct >= 2) { points += 1; reasons.push(`dividend yield ${yieldPct}%`); }
  if (nextEx) {
    const drop = recent.length ? r1(avg(recent.map((e) => e.exDayChangePct))) : undefined;
    reasons.push(`next ex-dividend expected around ${nextEx.month} (₹${nextEx.amount} last year)${drop !== undefined ? `; the price moved ${drop >= 0 ? "+" : ""}${drop}% on past ex-dates` : ""}${rec.length ? ` and took ${Math.round(avg(rec))} trading days on average to recover` : ""}`);
  }
  points = Math.max(-3, Math.min(3, points));

  const detail: SeasonalDetail = {
    months, window, quarters, dividends: events.slice(0, 10), annualDividend, yieldPct,
    avgExDayChangePct: recent.length ? r1(avg(recent.map((e) => e.exDayChangePct))) : undefined,
    avgRecoveryDays: rec.length ? Math.round(avg(rec)) : undefined, nextEx, years, dividendSource: data.dividendSource,
  };
  const any = years >= 3 || events.length > 0;
  return {
    agent: "Seasonal", points, tone: !any ? "n/a" : points >= 2 ? "good" : points >= 0 ? "ok" : "weak",
    verdict: !any ? "No data" : points >= 2 ? "Seasonal tailwind" : points < 0 ? "Seasonal headwind" : "Neutral season",
    metrics: [
      { label: `${MONTH[thisM - 1]}-${MONTH[nextM - 1]} up years`, unit: "%", value: years ? Math.round(wHit) : undefined, note: years ? `avg ${wAvg >= 0 ? "+" : ""}${r1(wAvg)}% · ${years} yrs` : "no history" },
      { label: "Dividend yield", unit: "%", value: yieldPct, note: annualDividend ? `₹${annualDividend} last 12 months` : "no dividend" },
      { label: "Ex-date move", unit: "%", value: detail.avgExDayChangePct, note: detail.avgRecoveryDays !== undefined ? `recovers in ~${detail.avgRecoveryDays} days` : events.length ? "slow recovery" : "no dividends" },
    ],
    reasons,
    seasonalDetail: detail,
  };
}

// ---------- data ----------

async function yahooSeasonal(symbol: string): Promise<SeasonalData> {
  const y = symbol.includes(".") ? symbol : `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?range=10y&interval=1d&events=div`;
  const [chart, ts] = await Promise.all([
    fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
    yahooTimeseries(symbol, ["quarterlyTotalRevenue", "quarterlyNetIncome"], 3).catch(() => ({} as Record<string, { date: string; v: number }[]>)),
  ]);
  const r = chart?.chart?.result?.[0];
  if (!r) throw new Error("no history");
  const q = r.indicators.quote[0];
  const day = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);
  const daily: Bar[] = [];
  (r.timestamp as number[]).forEach((t, i) => {
    const c = q.close[i] ?? (i === r.timestamp.length - 1 ? r.meta?.regularMarketPrice : null);
    if (c == null || q.open[i] == null) return;
    daily.push({ date: day(t), open: q.open[i], high: q.high[i] ?? c, low: q.low[i] ?? c, close: c, volume: q.volume[i] ?? 0 });
  });
  const dividends = Object.values((r.events?.dividends ?? {}) as Record<string, { date: number; amount: number }>)
    .map((d) => ({ date: day(d.date), amount: d.amount })).sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map<string, QuarterResult>();
  for (const p of ts.quarterlyTotalRevenue ?? []) byDate.set(p.date, { ...byDate.get(p.date), date: p.date, revenue: p.v / 1e7 });
  for (const p of ts.quarterlyNetIncome ?? []) byDate.set(p.date, { ...byDate.get(p.date), date: p.date, profit: p.v / 1e7 });
  // Official ex-dates and amounts from NSE's corporate actions when available.
  let divs = dividends, dividendSource = "Yahoo Finance";
  if (nseMcpEnabled() && daily.length) {
    try {
      const acts = await nseCorporateActions(symbol, daily[0].date);
      divs = acts.filter((a) => a.actionType === "DIVIDEND").map((a) => ({ date: a.exDate, amount: Math.round(dividendAmount(a.purpose) * 100) / 100 })).filter((d) => d.amount > 0).sort((a, b) => a.date.localeCompare(b.date));
      dividendSource = "NSE corporate actions (official)";
    } catch { /* keep Yahoo's */ }
  }
  return { daily, dividends: divs, quarters: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), sample: false, dividendSource };
}

function seeded(str: string) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Sample 10-year history for demo mode: month biases, dividends with ex-date drops, seasonal quarters. */
export function demoSeasonal(symbol: string, seed: number, recent: Bar[]): SeasonalData {
  const r = seeded(`season:${symbol}:${seed}`);
  const bias = Array.from({ length: 12 }, () => (r() - 0.45) * 0.004);
  const payer = r() < 0.75, divMonths = payer ? (r() < 0.5 ? [7] : [2, 8]) : [];
  const yieldTarget = 0.005 + r() * 0.03;
  const end = new Date(`${recent[recent.length - 1].date}T00:00:00Z`);
  const days: string[] = [];
  for (const d = new Date(end); days.length < 2500; d.setUTCDate(d.getUTCDate() - 1)) if (d.getUTCDay() % 6) days.unshift(d.toISOString().slice(0, 10));
  let price = recent[recent.length - 1].close;
  const closes = new Array(days.length);
  closes[days.length - 1] = price;
  for (let i = days.length - 1; i > 0; i--) { price /= Math.exp(bias[Number(days[i].slice(5, 7)) - 1] + (r() - 0.5) * 0.03); closes[i - 1] = price; }
  const daily: Bar[] = days.map((date, i) => ({ date, open: closes[i] * (1 + (r() - 0.5) * 0.004), high: closes[i] * 1.01, low: closes[i] * 0.99, close: closes[i], volume: 0 }));
  const dividends: Dividend[] = [];
  const seen = new Set<string>();
  daily.forEach((b, i) => {
    const m = Number(b.date.slice(5, 7)), key = b.date.slice(0, 7);
    if (i > 0 && divMonths.includes(m) && Number(b.date.slice(8)) >= 10 && !seen.has(key)) {
      seen.add(key);
      const amount = Math.round(daily[i - 1].close * yieldTarget / divMonths.length * 100) / 100;
      dividends.push({ date: b.date, amount });
      b.open = daily[i - 1].close - amount; b.close = Math.min(b.close, daily[i - 1].close - amount * 0.8);
    }
  });
  const rev0 = 1000 + r() * 20000, qb = [r() - 0.5, r() - 0.5, r() - 0.5, r() - 0.5].map((x) => x * 0.25);
  const quarters: QuarterResult[] = ["2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"].map((date, i) => {
    const revenue = rev0 * (1 + qb[fq(date) - 1]) * (1 + i * 0.02);
    return { date, revenue: Math.round(revenue), profit: Math.round(revenue * (0.08 + qb[fq(date) - 1] * 0.2)) };
  });
  return { daily, dividends, quarters, sample: true };
}

export async function loadSeasonal(symbols: string[], opts: { demo: boolean; seed: number; frames: Record<string, Bar[]> }): Promise<Record<string, SeasonalData | null>> {
  const out: Record<string, SeasonalData | null> = {};
  const queue = [...symbols];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      try { out[s] = opts.demo ? demoSeasonal(s, opts.seed, opts.frames[s]) : await yahooSeasonal(s); } catch { out[s] = null; }
    }
  }));
  return out;
}
