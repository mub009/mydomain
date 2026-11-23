/**
 * Sell check: should you keep holding a stock you already own?
 *
 * Uses the agents' fresh analysis of the stock (both scanners, the research
 * desk, the Black Points Analyst, the chart check) together with your own
 * buy price. The first rule that applies decides:
 *
 *  SELL          a verified red flag (Black Points: excluded), a severe red flag
 *                from the Red Flag Agent, a loss past your stop-loss (the larger
 *                of 8% or 3 days' average range below your buy price) while the
 *                agents are not positive on it, or a broken trend (AVOID with
 *                both scanners weak and the price below its 1-month trend).
 *                A loss past the stop-loss on a stock the agents still rate BUY
 *                with its trend holding is a HOLD with a fresh, tighter stop.
 *  BOOK PROFIT   a good gain (15%+) while momentum fades or the stock is
 *                overbought, or the agents now rate it AVOID / WATCH: sell half,
 *                keep the rest with a raised stop-loss
 *  HOLD          everything else, with the stop-loss to keep and the target
 */
import type { Decision } from "./types";

export type ExitAction = "SELL" | "BOOK PROFIT" | "HOLD";
export interface Holding { symbol: string; qty: number; avgPrice: number; source: string }
export interface ExitAdvice {
  symbol: string;
  sector: string;
  action: ExitAction;
  /** Shares to sell now. */
  sellQty: number;
  qty: number;
  avgPrice: number;
  price: number;
  pnlPct: number;
  pnl: number;
  verdict: Decision["verdict"];
  /** Why, most important first. */
  reasons: string[];
  /** For HOLD and BOOK PROFIT: the stop-loss to keep, and the target. */
  stop?: number;
  target?: number;
  sources: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function exitAdvice(d: Decision, h: { qty: number; avgPrice: number; sources: string[] }, price = d.entry): ExitAdvice {
  const pnlPct = h.avgPrice > 0 ? ((price - h.avgPrice) / h.avgPrice) * 100 : 0;
  const pnl = (price - h.avgPrice) * h.qty;
  const cutLossPct = Math.max(8, 3 * d.atrPct);
  const bp = d.blackPoints;
  const bpExcluded = bp && Object.values(bp.status).length > 0 && Object.values(bp.status).every((s) => s === "Excluded");
  const bpReview = bp && Object.values(bp.status).some((s) => s === "Needs Review");
  const trendBroken = d.mayavi < 40 && d.ret21d < 0;
  const weak = d.lotappi < 40 && d.mayavi < 40;
  const fading = d.lotappi < 50 || d.rsi > 75;
  const positive = d.verdict === "BUY" || d.verdict === "STRONG BUY";
  const belowStop = pnlPct <= -cutLossPct;
  const reasons: string[] = [];
  let action: ExitAction = "HOLD";

  const flag = bp?.findings.find((f) => f.materiality === "material");
  if (bpExcluded) {
    action = "SELL";
    reasons.push(`Black Points Analyst found a verified red flag${flag ? `: ${flag.flag.toLowerCase()}` : ""}`);
  } else if (d.desk?.severe) {
    action = "SELL";
    reasons.push(`Red Flag Agent: ${d.desk.redFlags?.reasons[0] ?? "a severe red flag (surveillance, pledge or default risk)"}`);
  } else if (pnlPct <= -cutLossPct && !(positive && d.mayavi >= 50)) {
    action = "SELL";
    reasons.push(`Down ${Math.abs(pnlPct).toFixed(1)}% from your buy price, past a ${cutLossPct.toFixed(0)}% stop-loss, and the agents aren't positive on it (${d.verdict}): cut the loss`);
  } else if (d.verdict === "AVOID" && weak && trendBroken) {
    action = "SELL";
    reasons.push(`Trend has broken: both scanners are weak (momentum ${d.lotappi.toFixed(0)}, trend ${d.mayavi.toFixed(0)}) and the price fell ${Math.abs(d.ret21d).toFixed(1)}% in a month`);
  } else if (pnlPct >= 15 && (fading || d.verdict === "AVOID" || d.verdict === "WATCH")) {
    action = "BOOK PROFIT";
    reasons.push(`Up ${pnlPct.toFixed(1)}% and ${d.rsi > 75 ? `overbought (RSI ${d.rsi.toFixed(0)})` : d.lotappi < 50 ? `momentum is fading (score ${d.lotappi.toFixed(0)})` : `the agents now rate it ${d.verdict}`}: sell half, keep the rest`);
  } else if (pnlPct > 5 && d.verdict === "AVOID") {
    action = "BOOK PROFIT";
    reasons.push(`In profit (${pnlPct.toFixed(1)}%) but the agents rate it AVOID now: take some profit`);
  }

  // Supporting reasons.
  if (action !== "SELL" && bpReview) reasons.push("Black Points Analyst has an unconfirmed risk to watch");
  if (action === "HOLD" && belowStop) {
    reasons.push(`Down ${Math.abs(pnlPct).toFixed(1)}%, past a ${cutLossPct.toFixed(0)}% stop-loss from your buy price, but the agents rate it ${d.verdict} now (score ${d.combined.toFixed(0)}) with the trend holding: keep it only with the fresh stop-loss below, and sell if it closes under it`);
  } else if (action === "HOLD") {
    if (d.verdict === "STRONG BUY" || d.verdict === "BUY") reasons.push(`Agents still rate it ${d.verdict} (score ${d.combined.toFixed(0)})`);
    else reasons.push(`Agents rate it ${d.verdict} (score ${d.combined.toFixed(0)}); no sell signal yet`);
    if (d.mayavi >= 60) reasons.push(`Trend intact (trend score ${d.mayavi.toFixed(0)})`);
    else if (trendBroken) reasons.push("Trend is weakening: keep the stop-loss tight");
  } else if (action === "SELL" && !reasons.some((r) => r.startsWith("Agents"))) {
    reasons.push(`Agents rate it ${d.verdict} (score ${d.combined.toFixed(0)})`);
  }
  if (d.fundamentals?.epsGrowth1y !== undefined && d.fundamentals.epsGrowth1y < -10) reasons.push(`Earnings fell ${Math.abs(d.fundamentals.epsGrowth1y).toFixed(0)}% over a year`);

  // Stop-loss to keep: never below the cut-loss level; raised to break-even once well in profit.
  // Already below that level: a fresh stop from today's price instead.
  const cut = h.avgPrice * (1 - cutLossPct / 100);
  let stop = belowStop ? Math.min(d.stopLoss, price * 0.99) : Math.max(cut, Math.min(d.stopLoss, price * 0.99));
  if (pnlPct >= 10) stop = Math.max(stop, h.avgPrice);
  const sellQty = action === "SELL" ? h.qty : action === "BOOK PROFIT" ? Math.max(1, Math.floor(h.qty / 2)) : 0;

  return {
    symbol: d.symbol, sector: d.sector, action, sellQty, qty: h.qty, avgPrice: r2(h.avgPrice), price: r2(price),
    pnlPct: r2(pnlPct), pnl: r2(pnl), verdict: d.verdict, reasons: reasons.slice(0, 4),
    ...(action !== "SELL" ? { stop: r2(stop), target: r2(Math.max(d.target, price * 1.05)) } : {}),
    sources: h.sources,
  };
}

/** Merge the same stock held in several places (Zerodha accounts, tracked trades): total qty, weighted buy price. */
export function mergeHoldings(list: Holding[]): Map<string, { qty: number; avgPrice: number; sources: string[] }> {
  const out = new Map<string, { qty: number; avgPrice: number; sources: string[] }>();
  for (const h of list) {
    if (!(h.qty > 0 && h.avgPrice > 0)) continue;
    const sym = h.symbol.toUpperCase().replace(/-(EQ|BE)$/, "");
    const cur = out.get(sym);
    if (!cur) out.set(sym, { qty: h.qty, avgPrice: h.avgPrice, sources: [h.source] });
    else {
      const qty = cur.qty + h.qty;
      out.set(sym, { qty, avgPrice: (cur.avgPrice * cur.qty + h.avgPrice * h.qty) / qty, sources: [...new Set([...cur.sources, h.source])] });
    }
  }
  return out;
}

export const ACTION_ORDER: Record<ExitAction, number> = { SELL: 0, "BOOK PROFIT": 1, HOLD: 2 };
