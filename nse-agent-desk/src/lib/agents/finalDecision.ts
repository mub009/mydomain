/** Agent 4 - Final Decision: turns Mubashir's analysis into verdicts, applies
 *  portfolio rules (sector concentration, capital) and chooses the picks. */
import type { Analysis, Decision, Verdict } from "../types";

export const MAX_PER_SECTOR = 2;

export class FinalDecision {
  verdict(r: Analysis): Verdict {
    if (r.combined >= 70 && r.agree && r.risk !== "HIGH") return "STRONG BUY";
    if (r.combined >= 60 && r.risk !== "HIGH") return "BUY";
    if (r.combined >= 48) return "WATCH";
    return "AVOID";
  }

  /** Stocks among the candidates that Final Decision wants to ask Mubashir about. */
  conflicted(rows: Analysis[], top: number): Analysis[] {
    return rows.slice(0, Math.max(top * 2, 10)).filter((r) => r.conflict && r.combined >= 48).slice(0, 2);
  }

  decide(rows: Analysis[], sparks: Record<string, number[]>, top: number,
    clarifications: Record<string, string>, capital?: number, riskPerTrade = 1) {
    const all: Decision[] = rows.map((r) => ({
      ...r, verdict: this.verdict(r), clarification: clarifications[r.symbol], spark: sparks[r.symbol] ?? [],
    }));

    // Choose picks in score order, but never more than MAX_PER_SECTOR from one sector.
    const picks: Decision[] = [], passed: Decision[] = [];
    const perSector: Record<string, number> = {};
    for (const d of all) {
      if (d.verdict !== "STRONG BUY" && d.verdict !== "BUY") continue;
      if (picks.length >= top) break;
      if ((perSector[d.sector] ?? 0) >= MAX_PER_SECTOR) {
        d.passedOver = `Sector cap: already ${MAX_PER_SECTOR} ${d.sector} picks`;
        passed.push(d);
        continue;
      }
      perSector[d.sector] = (perSector[d.sector] ?? 0) + 1;
      picks.push(d);
    }

    // Position sizing: Quantity = floor((Capital x Risk %) / (Entry - Stop-loss)),
    // capped by the capital still unallocated, so the total never exceeds capital.
    if (capital && capital > 0) {
      let remaining = capital;
      for (const p of picks) {
        const perShare = Math.max(p.entry - p.stopLoss, 0.01);
        const riskQty = Math.floor((capital * riskPerTrade) / 100 / perShare);
        const qty = Math.max(0, Math.min(riskQty, Math.floor(remaining / p.entry)));
        p.quantity = qty;
        p.investment = Math.round(qty * p.entry * 100) / 100;
        remaining -= p.investment;
      }
    }

    const watchlist = [...passed, ...all.filter((d) => d.verdict === "WATCH")].slice(0, Math.max(top, 5));
    return { all, picks, watchlist, passed };
  }
}
