"""Agent 4 - Final Decision: reads Mubashir's analysis, questions any conflicts,
and announces the final list of good stocks."""
from __future__ import annotations

from .base import Agent


class FinalDecision(Agent):
    name = "FinalDecision"
    role = "final decision maker who picks the stocks to act on"

    def verdict(self, r: dict) -> str:
        c = r["combined"]
        if c >= 70 and r["agree"] and r["risk"] != "HIGH":
            return "STRONG BUY"
        if c >= 60 and r["risk"] != "HIGH":
            return "BUY"
        if c >= 48:
            return "WATCH"
        return "AVOID"

    def run(self, mubashir, top: int, capital: float | None, risk_per_trade: float) -> dict:
        rows = self.bus.latest(self.name, "Mubashir").payload

        # Communication round: ask the analyst about conflicts among candidates.
        candidates = rows[: max(top * 2, 10)]
        conflicted = [r["symbol"] for r in candidates if r["conflict"] and r["combined"] >= 48]
        clarifications = {}
        if conflicted:
            self.say("Mubashir", "Question on conflicts",
                     f"Lotappi and Mayavi disagree on {', '.join(conflicted)}. Which view should I trust?",
                     conflicted)
            clarifications = mubashir.answer(conflicted, rows)

        decisions = []
        for r in rows:
            d = dict(r, verdict=self.verdict(r), clarification=clarifications.get(r["symbol"]))
            if capital:
                risk_amt = capital * risk_per_trade / 100
                per_share = max(d["entry"] - d["stop_loss"], 0.01)
                qty = int(min(risk_amt / per_share, capital * 0.2 / d["entry"]))  # max 20% per stock
                d["quantity"] = qty
                d["investment"] = round(qty * d["entry"], 2)
            decisions.append(d)

        picks = [d for d in decisions if d["verdict"] in ("STRONG BUY", "BUY")][:top]
        watch = [d for d in decisions if d["verdict"] == "WATCH"][:top]

        if picks:
            lines = ["FINAL PICKS:"] + [
                f"  {d['verdict']:<10} {d['symbol']:<12} entry {d['entry']:>9.2f}  SL {d['stop_loss']:>9.2f}  "
                f"target {d['target']:>9.2f}  [{d['horizon']}]" for d in picks]
        else:
            lines = ["No stock passes the buy rules today - staying in cash is a valid decision."]
        if watch:
            lines.append("Watchlist: " + ", ".join(d["symbol"] for d in watch))
        text = "\n".join(lines)
        note = self.explain(
            "Give the team's final decision in 5-8 lines: why these picks, how to manage them "
            "(stop-loss, target), and one sentence reminding this is not financial advice.",
            {"picks": picks, "watchlist": [w["symbol"] for w in watch]})
        if note:
            text += f"\n\nFinal word: {note}"
        self.say("ALL", "Final decision", text, picks)
        return {"picks": picks, "watchlist": watch, "all": decisions, "summary": note}
