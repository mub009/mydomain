/** Agent 4 - Final Decision: reads Mubashir's analysis, questions conflicts,
 *  and announces the final list of good stocks. */
import type { Analysis, Decision, Verdict } from "../types";
import { Agent } from "./base";
import type { Mubashir } from "./mubashir";

export class FinalDecision extends Agent {
  name = "FinalDecision" as const;
  role = "final decision maker who picks the stocks to act on";

  verdict(r: Analysis): Verdict {
    if (r.combined >= 70 && r.agree && r.risk !== "HIGH") return "STRONG BUY";
    if (r.combined >= 60 && r.risk !== "HIGH") return "BUY";
    if (r.combined >= 48) return "WATCH";
    return "AVOID";
  }

  async run(mubashir: Mubashir, top: number, capital?: number, riskPerTrade = 1) {
    const rows = this.bus.latest<Analysis[]>(this.name, "Mubashir");

    // Communication round: ask the analyst about conflicts among candidates.
    const conflicted = rows.slice(0, Math.max(top * 2, 10))
      .filter((r) => r.conflict && r.combined >= 48).map((r) => r.symbol);
    let clarifications: Record<string, string> = {};
    if (conflicted.length) {
      this.bus.send(this.name, "Mubashir", "Question on conflicts",
        `Lotappi and Mayavi disagree on ${conflicted.join(", ")}. Which view should I trust?`, conflicted);
      clarifications = mubashir.answer(conflicted, rows);
    }

    const all: Decision[] = rows.map((r) => {
      const d: Decision = { ...r, verdict: this.verdict(r), clarification: clarifications[r.symbol] };
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

    const lines = picks.length
      ? ["FINAL PICKS:", ...picks.map((d) =>
          `  ${d.verdict.padEnd(10)} ${d.symbol.padEnd(12)} entry ${d.entry.toFixed(2)}  SL ${d.stopLoss.toFixed(2)}  target ${d.target.toFixed(2)}  [${d.horizon}]`)]
      : ["No stock passes the buy rules today - staying in cash is a valid decision."];
    if (watchlist.length) lines.push(`Watchlist: ${watchlist.map((d) => d.symbol).join(", ")}`);

    const note = await this.explain(
      "Give the team's final decision in 5-8 lines: why these picks, how to manage them (stop-loss, target), " +
      "and one sentence reminding this is not financial advice.",
      { picks, watchlist: watchlist.map((w) => w.symbol) });
    this.bus.send(this.name, "ALL", "Final decision", lines.join("\n"), picks, note);
    return { picks, watchlist, all };
  }
}
