/** Agent 3 - Mubashir: the analyst. Merges Lotappi's and Mayavi's reports,
 *  checks agreement, rates risk and prepares the trade scenario. */
import { sectorOf } from "../market/universe";
import type { AgentReport, Analysis, ChartAnalysis, Fundamentals, Risk, Snapshot } from "../types";
import { clamp, round } from "./base";

export class Mubashir {
  analyseOne(symbol: string, lot: AgentReport, may: AgentReport, s: Snapshot): Analysis {
    let combined = 0.5 * lot.score + 0.5 * may.score;
    const notes: string[] = [];

    const agree = lot.score >= 60 && may.score >= 60;
    const conflict = !agree && Math.abs(lot.score - may.score) > 25;
    if (agree) { combined += 5; notes.push("Both Lotappi and Mayavi like it"); }
    if (conflict) notes.push(`Conflict: Lotappi ${lot.score.toFixed(0)} vs Mayavi ${may.score.toFixed(0)}`);

    const riskPts = Number(s.atrPct > 4) + Number(s.volatility21d > 45) + Number(s.rsi > 75);
    const risk: Risk = riskPts === 0 ? "LOW" : riskPts === 1 ? "MEDIUM" : "HIGH";
    combined -= 5 * riskPts;
    if (riskPts) notes.push(`Risk ${risk.toLowerCase()}: ATR ${s.atrPct.toFixed(1)}% of price, volatility ${s.volatility21d.toFixed(0)}%`);

    const horizon = agree ? "Swing, then hold ~1 month"
      : lot.score >= may.score ? "Swing · 1-10 days" : "Positional · ~1 month";

    // Wider stop for longer holds. Target = Entry + 2 x (Entry - Stop-loss).
    const mult = horizon.startsWith("Swing ·") ? 1.5 : 2.5;
    const entry = s.close, stop = entry - mult * s.atr, target = entry + 2 * (entry - stop);

    return {
      symbol, sector: sectorOf(symbol), combined: round(clamp(combined)), lotappi: lot.score, mayavi: may.score,
      agree, conflict, risk, horizon,
      entry: round(entry, 2), stopLoss: round(stop, 2), target: round(target, 2),
      rsi: round(s.rsi), ret5d: round(s.ret5d, 2), ret21d: round(s.ret21d, 2),
      volRatio: round(s.volRatio, 2), atrPct: round(s.atrPct, 2),
      lotReasons: lot.reasons, lotWarnings: lot.warnings, mayReasons: may.reasons, mayWarnings: may.warnings, notes,
    };
  }

  analyse(lot: AgentReport[], may: AgentReport[], snaps: Record<string, Snapshot>): Analysis[] {
    const m = new Map(may.map((r) => [r.symbol, r]));
    return lot.map((l) => this.analyseOne(l.symbol, l, m.get(l.symbol)!, snaps[l.symbol]))
      .sort((a, b) => b.combined - a.combined);
  }

  /**
   * Earnings and size check.
   *  EPS over the last year: +5 if up 20% or more, +3 if up 10-20%, +1 if up
   *  0-10%, -4 if down, -6 if the company is loss-making (negative EPS).
   *  Small caps move more, so their risk is at least Medium.
   */
  applyFundamentals(rows: Analysis[], funds: Record<string, Fundamentals>): Analysis[] {
    return rows.map((r) => {
      const f = funds[r.symbol];
      if (!f) return r;
      const notes = [...r.notes];
      let adj = 0, risk = r.risk;
      const g = f.epsGrowth1y;
      if (f.epsTTM !== undefined && f.epsTTM < 0) { adj = -6; notes.push(`Loss-making: EPS ₹${f.epsTTM} over the last year`); }
      else if (g === undefined) notes.push(f.epsTTM === undefined ? "EPS not available" : "EPS growth can't be measured (loss a year ago)");
      else if (g >= 20) { adj = 5; notes.push(`EPS up ${g}% in a year`); }
      else if (g >= 10) { adj = 3; notes.push(`EPS up ${g}% in a year`); }
      else if (g >= 0) { adj = 1; notes.push(`EPS up ${g}% in a year (slow)`); }
      else { adj = -4; notes.push(`EPS down ${Math.abs(g)}% in a year`); }
      if (f.cap === "Small") { notes.push("Small cap: bigger swings, size carefully"); if (risk === "LOW") risk = "MEDIUM"; }
      if (f.cap === "Unknown") notes.push("Market cap not verified");
      return { ...r, fundamentals: f, notes, risk, combined: round(clamp(r.combined + adj)) };
    }).sort((a, b) => b.combined - a.combined);
  }

  /**
   * Fold the chart check into the scores: each timeframe that is bullish adds
   * 1.5 points and each bearish one takes 1.5 away (at most +/-7.5).
   */
  applyCharts(rows: Analysis[], charts: Record<string, ChartAnalysis>): Analysis[] {
    return rows.map((r) => {
      const c = charts[r.symbol];
      if (!c) return r;
      const adj = (c.bullish - c.bearish) * 1.5;
      const notes = [...r.notes, `Charts: ${c.bullish} of 5 timeframes bullish, ${c.bearish} bearish`];
      if (c.zone) notes.push(`Buy zone ₹${c.zone.low.toLocaleString("en-IN")}-₹${c.zone.high.toLocaleString("en-IN")} (${c.zone.plan.toLowerCase()})`);
      return { ...r, chart: c, notes, combined: round(clamp(r.combined + adj)) };
    }).sort((a, b) => b.combined - a.combined);
  }

  /** Mubashir's advice when Lotappi and Mayavi disagree on a stock: evidence, trade-off, uncertainty. */
  adviseOnConflict(r: Analysis): string {
    return r.lotappi > r.mayavi
      ? `Lotappi scores it ${r.lotappi.toFixed(0)}, Mayavi only ${r.mayavi.toFixed(0)}. The evidence favours a short trade: momentum is there (${r.ret5d >= 0 ? "+" : ""}${r.ret5d.toFixed(1)}% in 5 days) but the monthly trend is weak. Trade-off: quick gain vs no trend support, so it is a tight-stop swing at best. I would not hold it for a month.`
      : `Mayavi scores it ${r.mayavi.toFixed(0)}, Lotappi only ${r.lotappi.toFixed(0)}. The evidence favours the 1-month view: the trend is sound (${r.ret21d >= 0 ? "+" : ""}${r.ret21d.toFixed(1)}% over the month) but short-term timing is poor. Trade-off: buying now risks an early dip. I'd wait for a pullback or a fresh breakout; I can't tell which comes first.`;
  }
}
