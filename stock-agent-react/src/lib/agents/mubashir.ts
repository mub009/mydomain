/** Agent 3 - Mubashir: the analyst. Merges Lotappi's and Mayavi's reports,
 *  checks agreement, rates risk and prepares trade levels. */
import type { AgentReport, Analysis, Risk, Snapshot } from "../types";
import { Agent, clamp, round } from "./base";

export class Mubashir extends Agent {
  name = "Mubashir" as const;
  role = "analyst who combines the short-term and 1-month reports and checks risk";

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

    const horizon = agree ? "Both (swing now, hold ~1 month)"
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

  async run(snaps: Record<string, Snapshot>): Promise<Analysis[]> {
    const lot = new Map(this.bus.latest<AgentReport[]>(this.name, "Lotappi").map((r) => [r.symbol, r]));
    const may = new Map(this.bus.latest<AgentReport[]>(this.name, "Mayavi").map((r) => [r.symbol, r]));
    const rows = [...lot.keys()].map((sym) => this.analyseOne(sym, lot.get(sym)!, may.get(sym)!, snaps[sym]))
      .sort((a, b) => b.combined - a.combined);

    const agreed = rows.filter((r) => r.agree).map((r) => r.symbol);
    const conflicts = rows.slice(0, 10).filter((r) => r.conflict).map((r) => r.symbol);
    const text = [
      `Combined ${rows.length} stocks.`,
      `Both agents agree on: ${agreed.join(", ") || "none"}`,
      `Conflicts in top 10: ${conflicts.join(", ") || "none"}`,
      "Top combined scores:",
      ...rows.slice(0, 8).map((r) => `  ${r.symbol.padEnd(12)} ${r.combined.toFixed(1).padStart(5)}  risk ${r.risk.padEnd(6)} ${r.horizon}`),
    ].join("\n");
    const note = await this.explain(
      "In 5-7 lines, explain where the short-term and 1-month views agree or conflict, and which stocks look strongest after risk.",
      rows.slice(0, 8));
    this.bus.send(this.name, "FinalDecision", "Combined analysis", text, rows, note);
    return rows;
  }

  /** Reply to the Final Decision agent's questions about conflicted stocks. */
  answer(symbols: string[], rows: Analysis[]): Record<string, string> {
    const by = new Map(rows.map((r) => [r.symbol, r]));
    const answers: Record<string, string> = {};
    for (const sym of symbols) {
      const r = by.get(sym)!;
      answers[sym] = r.lotappi > r.mayavi
        ? "Trust the short-term view only: momentum is there but the monthly trend is weak. Use the tight stop and book profits fast."
        : "Trust the 1-month view: trend is good but short-term timing is weak. Wait for a dip or a fresh breakout before entering.";
    }
    this.bus.send(this.name, "FinalDecision", "Re: conflicted stocks",
      Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join("\n"), answers);
    return answers;
  }
}
