/** Agent 3 - Mubashir: the analyst. Merges Lotappi's and Mayavi's reports,
 *  checks agreement, rates risk and prepares trade levels. */
import type { AgentReport, Analysis, Risk, Snapshot } from "../types";
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
    if (riskPts) notes.push(`Risk ${risk}: ATR ${s.atrPct.toFixed(1)}% of price, volatility ${s.volatility21d.toFixed(0)}%`);

    const horizon = agree ? "Swing now, hold ~1 month"
      : lot.score >= may.score ? "Short-term swing (1-10 days)" : "1-month positional";

    // Wider stop for longer holds; target at 2:1 reward-to-risk.
    const mult = horizon.startsWith("Short") ? 1.5 : 2.5;
    const entry = s.close, stop = entry - mult * s.atr, target = entry + 2 * (entry - stop);

    return {
      symbol, combined: round(clamp(combined)), lotappi: lot.score, mayavi: may.score,
      agree, conflict, risk, horizon,
      entry: round(entry, 2), stopLoss: round(stop, 2), target: round(target, 2),
      rsi: round(s.rsi), ret5d: round(s.ret5d, 2), ret21d: round(s.ret21d, 2),
      reasons: [...lot.reasons.slice(0, 3), ...may.reasons.slice(0, 3)],
      warnings: [...lot.warnings, ...may.warnings], notes,
    };
  }

  analyse(lot: AgentReport[], may: AgentReport[], snaps: Record<string, Snapshot>): Analysis[] {
    const m = new Map(may.map((r) => [r.symbol, r]));
    return lot.map((l) => this.analyseOne(l.symbol, l, m.get(l.symbol)!, snaps[l.symbol]))
      .sort((a, b) => b.combined - a.combined);
  }

  /** Mubashir's advice when Lotappi and Mayavi disagree on a stock. */
  adviseOnConflict(r: Analysis): string {
    return r.lotappi > r.mayavi
      ? `trust Lotappi's short-term view only. Momentum is there but the monthly trend is weak, so use the tight stop and book profits quickly.`
      : `trust Mayavi's 1-month view. The trend is good but short-term timing is weak, so wait for a dip or a fresh breakout before entering.`;
  }
}
