/** Agent 4 - Final Decision: turns Mubashir's analysis into verdicts and picks. */
import type { Analysis, Decision, Verdict } from "../types";

export class FinalDecision {
  verdict(r: Analysis): Verdict {
    if (r.combined >= 70 && r.agree && r.risk !== "HIGH") return "STRONG BUY";
    if (r.combined >= 60 && r.risk !== "HIGH") return "BUY";
    if (r.combined >= 48) return "WATCH";
    return "AVOID";
  }

  /** Stocks among the candidates that Final Decision wants to ask Mubashir about. */
  conflicted(rows: Analysis[], top: number): Analysis[] {
    return rows.slice(0, Math.max(top * 2, 10)).filter((r) => r.conflict && r.combined >= 48);
  }

  decide(rows: Analysis[], sparks: Record<string, number[]>, top: number,
    clarifications: Record<string, string>, capital?: number, riskPerTrade = 1) {
    const all: Decision[] = rows.map((r) => {
      const d: Decision = { ...r, verdict: this.verdict(r), clarification: clarifications[r.symbol], spark: sparks[r.symbol] ?? [] };
      if (capital) {
        const perShare = Math.max(d.entry - d.stopLoss, 0.01);
        const qty = Math.floor(Math.min((capital * riskPerTrade) / 100 / perShare, (capital * 0.2) / d.entry));
        d.quantity = qty;
        d.investment = Math.round(qty * d.entry * 100) / 100;
      }
      return d;
    });
    const picks = all.filter((d) => d.verdict === "STRONG BUY" || d.verdict === "BUY").slice(0, top);
    const watchlist = all.filter((d) => d.verdict === "WATCH").slice(0, top);
    return { all, picks, watchlist };
  }
}
