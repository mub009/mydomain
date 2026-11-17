/**
 * Research Agent's balance-sheet and cash-flow quality check.
 *
 * For most companies (6 checks, each +1 good / 0 ok / -1 weak; cash conversion counts double):
 *   cash conversion  operating cash flow ÷ net profit, last 3 years   ≥1.0 good, <0.8 weak
 *   free cash flow   years with positive FCF (of the last 4)         ≥3 good, ≤1 weak
 *   debt / equity                                                    ≤0.5 good, >1.5 weak
 *   current ratio    current assets ÷ current liabilities            ≥1.2 good, <1.0 weak
 *   ROE              net profit ÷ equity                             ≥15% good, <8% weak
 *   interest cover   EBIT ÷ interest                                 ≥5 good, <2 weak
 * Grade: 5+ A, 3-4 B, 1-2 C, below 1 D.
 *
 * Banks and NBFCs borrow and lend as their business, so debt, current ratio and
 * operating cash flow don't mean the same thing. For them only ROE and profit
 * growth are graded, and the grade is marked as limited.
 */
import type { Quality, QualityCheck, Ratios, YearFinancials } from "./types";

const FINANCIAL = new Set(["Banks", "Financials"]);
const r2 = (n: number) => Math.round(n * 100) / 100;
const last = <T,>(a: T[]) => a[a.length - 1];

export function computeRatios(years: YearFinancials[]): Ratios {
  const y = last(years);
  const recent = years.slice(-3);
  const sumCfo = recent.reduce((s, x) => s + (x.operatingCashFlow ?? 0), 0);
  const sumNi = recent.reduce((s, x) => s + (x.netIncome ?? 0), 0);
  const haveCfo = recent.every((x) => x.operatingCashFlow !== undefined && x.netIncome !== undefined);
  const fcf = years.slice(-4).map((x) => x.freeCashFlow ?? (x.operatingCashFlow !== undefined && x.capex !== undefined ? x.operatingCashFlow - x.capex : undefined));
  return {
    roe: y?.netIncome !== undefined && y.equity ? r2((y.netIncome / y.equity) * 100) : undefined,
    debtToEquity: y?.debt !== undefined && y.equity ? r2(y.debt / y.equity) : undefined,
    currentRatio: y?.currentAssets !== undefined && y.currentLiabilities ? r2(y.currentAssets / y.currentLiabilities) : undefined,
    cashConversion: haveCfo && sumNi > 0 ? r2(sumCfo / sumNi) : undefined,
    interestCover: y?.ebit !== undefined && y.interestExpense ? r2(y.ebit / Math.abs(y.interestExpense)) : undefined,
    fcfPositiveYears: fcf.every((v) => v !== undefined) && fcf.length ? fcf.filter((v) => (v as number) > 0).length : undefined,
    years: years.length,
  };
}

export function gradeQuality(years: YearFinancials[], sector: string): { ratios: Ratios; quality: Quality } {
  const ratios = computeRatios(years);
  const financialSector = FINANCIAL.has(sector);
  const checks: QualityCheck[] = [];
  const add = (label: string, v: number | undefined, fmt: (n: number) => string, good: (n: number) => boolean, weak: (n: number) => boolean, notes: [string, string, string]) => {
    if (v === undefined) { checks.push({ label, value: "–", verdict: "n/a", note: "Not available" }); return; }
    const verdict = good(v) ? "good" : weak(v) ? "weak" : "ok";
    checks.push({ label, value: fmt(v), verdict, note: notes[verdict === "good" ? 0 : verdict === "ok" ? 1 : 2] });
  };

  const y = last(years), prev = years[years.length - 2];
  const growth = y?.netIncome !== undefined && prev?.netIncome && prev.netIncome > 0 ? ((y.netIncome / prev.netIncome) - 1) * 100 : undefined;

  if (!financialSector) {
    add("Cash conversion", ratios.cashConversion, (n) => `${n.toFixed(2)}×`, (n) => n >= 1, (n) => n < 0.8,
      ["Profits are fully backed by cash", "Most profit turns into cash", "Profits are not turning into cash; check receivables and inventory"]);
    add("Free cash flow", ratios.fcfPositiveYears, (n) => `${n} of 4 years positive`, (n) => n >= 3, (n) => n <= 1,
      ["Generates cash after investment", "Free cash flow is uneven", "Spends more than it earns in cash; needs borrowing or new shares"]);
    add("Debt / equity", ratios.debtToEquity, (n) => n.toFixed(2), (n) => n <= 0.5, (n) => n > 1.5,
      ["Low debt", "Moderate debt", "High debt; sensitive to interest rates"]);
    add("Current ratio", ratios.currentRatio, (n) => n.toFixed(2), (n) => n >= 1.2, (n) => n < 1,
      ["Comfortable short-term liquidity", "Liquidity is adequate", "Short-term liabilities exceed short-term assets"]);
  }
  add("Return on equity", ratios.roe, (n) => `${n.toFixed(1)}%`, (n) => n >= 15, (n) => n < 8,
    ["Earns well on shareholders' money", "Average return on equity", "Low return on shareholders' money"]);
  if (!financialSector) {
    add("Interest cover", ratios.interestCover, (n) => `${n.toFixed(1)}×`, (n) => n >= 5, (n) => n < 2,
      ["Interest is easily covered", "Interest is covered", "Profits barely cover interest"]);
  } else {
    add("Profit growth (1Y)", growth, (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`, (n) => n >= 15, (n) => n < 0,
      ["Profits growing well", "Profits growing slowly", "Profits fell"]);
  }

  const rated = checks.filter((c) => c.verdict !== "n/a");
  let pts = 0;
  for (const c of rated) {
    const w = c.label === "Cash conversion" ? 2 : 1;
    pts += c.verdict === "good" ? w : c.verdict === "weak" ? -w : 0;
  }
  let grade: Quality["grade"] = rated.length < 2 ? "n/a" : pts >= 5 ? "A" : pts >= 3 ? "B" : pts >= 1 ? "C" : "D";
  if (financialSector && grade !== "n/a") grade = pts >= 2 ? "A" : pts >= 1 ? "B" : pts >= 0 ? "C" : "D";

  // A loss-making company can't grade above C, whatever the other checks say.
  const loss = y?.netIncome !== undefined && y.netIncome < 0;
  if (loss && (grade === "A" || grade === "B")) grade = "C";

  const weak = rated.filter((c) => c.verdict === "weak").map((c) => c.label.toLowerCase());
  const good = rated.filter((c) => c.verdict === "good").map((c) => c.label.toLowerCase());
  const summary = grade === "n/a" ? "Not enough financial data to grade this company."
    : `Grade ${grade}${financialSector ? " (limited: bank/NBFC)" : ""}. ` + (loss ? "Loss-making in the latest year. " : "") +
      (good.length ? `Strong on ${good.join(", ")}. ` : "") + (weak.length ? `Weak on ${weak.join(", ")}.` : "No weak spots in these checks.");
  return { ratios, quality: { grade, checks, summary, financialSector } };
}
