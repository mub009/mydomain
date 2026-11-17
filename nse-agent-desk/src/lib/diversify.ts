/**
 * Mubashir's diversification check for a set of holdings (your open positions,
 * or the day's picks).
 *
 * Limits (adjustable with MAX_SECTOR_PCT / MAX_STOCK_PCT / MAX_SMALLCAP_PCT):
 *   one sector      ≤ 30% of the money
 *   one stock       ≤ 20%
 *   small caps      ≤ 30%
 *   two holdings whose daily moves correlate ≥ 0.8 over 60 days count as one bet
 *
 * Score (0-100): starts from how many "effective" sectors and stocks the money
 * is spread over (1 / sum of squared weights), minus penalties for each limit
 * broken. Grade: 80+ A, 60-79 B, 40-59 C, below 40 D.
 */
import type { CapSize, Decision } from "./types";

export interface Holding {
  symbol: string;
  sector: string;
  cap: CapSize;
  /** ₹ value used for weights (current value for positions, planned investment for picks). */
  value: number;
  /** Recent closes, for correlation (optional). */
  closes?: number[];
}

export interface Slice { name: string; value: number; pct: number }
export interface DivWarning { kind: "sector" | "stock" | "smallcap" | "correlated" | "few"; text: string; severity: "warning" | "critical"; /** score points taken off */ penalty: number }
export interface Suggestion { symbol: string; sector: string; action: "add" | "trim"; reason: string }

export interface Diversification {
  total: number;
  count: number;
  bySector: Slice[];
  byCap: Slice[];
  byStock: Slice[];
  effectiveSectors: number;
  effectiveStocks: number;
  correlated: { a: string; b: string; rho: number }[];
  score: number;
  grade: "A" | "B" | "C" | "D" | "n/a";
  warnings: DivWarning[];
  suggestions: Suggestion[];
  summary: string;
  limits: { sector: number; stock: number; smallcap: number };
}

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
export const divLimits = () => ({
  sector: num(process.env.NEXT_PUBLIC_MAX_SECTOR_PCT, 30),
  stock: num(process.env.NEXT_PUBLIC_MAX_STOCK_PCT, 20),
  smallcap: num(process.env.NEXT_PUBLIC_MAX_SMALLCAP_PCT, 30),
});

function group(h: Holding[], key: (x: Holding) => string, total: number): Slice[] {
  const m = new Map<string, number>();
  for (const x of h) m.set(key(x), (m.get(key(x)) ?? 0) + x.value);
  return [...m].map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 1000) / 10 })).sort((a, b) => b.value - a.value);
}

const effective = (slices: Slice[]) => {
  const s = slices.reduce((acc, x) => acc + (x.pct / 100) ** 2, 0);
  return s ? Math.round((1 / s) * 10) / 10 : 0;
};

/** Pearson correlation of daily returns over the overlapping recent window. */
export function correlation(a: number[], b: number[]): number | undefined {
  const n = Math.min(a.length, b.length);
  if (n < 21) return undefined;
  const ra = a.slice(-n).map((x, i, arr) => (i ? x / arr[i - 1] - 1 : 0)).slice(1);
  const rb = b.slice(-n).map((x, i, arr) => (i ? x / arr[i - 1] - 1 : 0)).slice(1);
  const ma = ra.reduce((s, x) => s + x, 0) / ra.length, mb = rb.reduce((s, x) => s + x, 0) / rb.length;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < ra.length; i++) { cov += (ra[i] - ma) * (rb[i] - mb); va += (ra[i] - ma) ** 2; vb += (rb[i] - mb) ** 2; }
  return va && vb ? Math.round((cov / Math.sqrt(va * vb)) * 100) / 100 : undefined;
}

/** Penalty grows with how far past the limit: a little over costs 4, 1.5× or more costs 25. */
const pen = (ratio: number) => (ratio >= 1.5 ? 25 : ratio >= 1.25 ? 9 : 4);

export function diversify(holdings: Holding[], candidates: Decision[] = [], limits = divLimits()): Diversification {
  // Merge repeat holdings of the same stock.
  const merged = [...holdings.reduce((m, h) => {
    const cur = m.get(h.symbol);
    m.set(h.symbol, cur ? { ...cur, value: cur.value + h.value } : { ...h });
    return m;
  }, new Map<string, Holding>()).values()].filter((h) => h.value > 0);
  const total = merged.reduce((s, h) => s + h.value, 0);
  const empty: Diversification = {
    total: 0, count: 0, bySector: [], byCap: [], byStock: [], effectiveSectors: 0, effectiveStocks: 0, correlated: [],
    score: 0, grade: "n/a", warnings: [], suggestions: [], summary: "Nothing to check yet.", limits,
  };
  if (!merged.length || !total) return empty;

  const bySector = group(merged, (h) => h.sector, total);
  const byCap = group(merged, (h) => (h.cap === "Large" || h.cap === "Mid" || h.cap === "Small" ? `${h.cap} cap` : "Unknown size"), total);
  const byStock = group(merged, (h) => h.symbol, total);
  const effectiveSectors = effective(bySector), effectiveStocks = effective(byStock);

  const warnings: DivWarning[] = [];
  const suggestions: Suggestion[] = [];
  for (const s of bySector.filter((x) => x.pct > limits.sector)) {
    warnings.push({ kind: "sector", severity: s.pct > limits.sector * 1.5 ? "critical" : "warning", penalty: pen(s.pct / limits.sector),
      text: `${s.name} is ${s.pct}% of the money (limit ${limits.sector}%). One bad news day for ${s.name.toLowerCase()} hits the whole portfolio.` });
  }
  for (const s of byStock.filter((x) => x.pct > limits.stock)) {
    warnings.push({ kind: "stock", severity: s.pct > limits.stock * 1.5 ? "critical" : "warning", penalty: pen(s.pct / limits.stock), text: `${s.name} is ${s.pct}% of the money (limit ${limits.stock}%).` });
    suggestions.push({ symbol: s.name, sector: merged.find((h) => h.symbol === s.name)!.sector, action: "trim",
      reason: `Trim to about ${limits.stock}% (sell roughly ${Math.round(((s.pct - limits.stock) / s.pct) * 100)}% of it).` });
  }
  const small = byCap.find((x) => x.name === "Small cap")?.pct ?? 0;
  if (small > limits.smallcap) warnings.push({ kind: "smallcap", severity: small > limits.smallcap * 1.5 ? "critical" : "warning", penalty: pen(small / limits.smallcap), text: `Small caps are ${small}% (limit ${limits.smallcap}%). They swing more and are harder to sell in a fall.` });
  if (merged.length >= 3 && bySector.length < 3) warnings.push({ kind: "few", severity: "warning", penalty: 9, text: `Only ${bySector.length} sector${bySector.length === 1 ? "" : "s"} for ${merged.length} stocks. Aim for at least 3-4.` });

  const correlated: Diversification["correlated"] = [];
  for (let i = 0; i < merged.length; i++) for (let j = i + 1; j < merged.length; j++) {
    const a = merged[i], b = merged[j];
    if (!a.closes || !b.closes) continue;
    const rho = correlation(a.closes, b.closes);
    if (rho !== undefined && rho >= 0.8) correlated.push({ a: a.symbol, b: b.symbol, rho });
  }
  for (const c of correlated.slice(0, 3)) {
    warnings.push({ kind: "correlated", severity: "warning", penalty: 6, text: `${c.a} and ${c.b} move together (correlation ${c.rho.toFixed(2)} over 60 days), so they behave almost like one holding.` });
  }

  // Suggest good-rated candidates from sectors the portfolio is light in.
  const held = new Set(merged.map((h) => h.symbol));
  const weight = new Map(bySector.map((s) => [s.name, s.pct]));
  const heavy = new Set(bySector.filter((s) => s.pct > limits.sector).map((s) => s.name));
  const adds = candidates
    .filter((c) => !held.has(c.symbol) && c.sector !== "Other" && !heavy.has(c.sector) && (weight.get(c.sector) ?? 0) < limits.sector / 2 &&
      (c.verdict === "STRONG BUY" || c.verdict === "BUY"))
    .sort((a, b) => (weight.get(a.sector) ?? 0) - (weight.get(b.sector) ?? 0) || b.combined - a.combined);
  const usedSectors = new Set<string>();
  for (const c of adds) {
    if (usedSectors.has(c.sector) || usedSectors.size >= 3) continue;
    usedSectors.add(c.sector);
    suggestions.push({ symbol: c.symbol, sector: c.sector, action: "add",
      reason: `${c.verdict} in ${c.sector}, ${weight.get(c.sector) ? `only ${weight.get(c.sector)}% now` : "a sector you don't hold yet"} (score ${c.combined.toFixed(0)}).` });
  }

  // Score: spread (up to 100) minus penalties.
  const spread = Math.min(1, effectiveSectors / 5) * 55 + Math.min(1, effectiveStocks / 6) * 45;
  const penalty = warnings.reduce((s, w) => s + w.penalty, 0);
  const score = Math.max(0, Math.min(100, Math.round(spread - penalty)));
  const grade: Diversification["grade"] = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
  const top = bySector[0];
  const summary = `Grade ${grade} (${score}/100). ${merged.length} stock${merged.length === 1 ? "" : "s"} across ${bySector.length} sector${bySector.length === 1 ? "" : "s"}; ` +
    `the money behaves like about ${effectiveSectors} equal sectors. Largest sector: ${top.name} ${top.pct}%.` +
    (warnings.length ? ` ${warnings.length} issue${warnings.length === 1 ? "" : "s"} to fix.` : " No limits broken.");
  return { total, count: merged.length, bySector, byCap, byStock, effectiveSectors, effectiveStocks, correlated, score, grade, warnings, suggestions, summary, limits };
}
