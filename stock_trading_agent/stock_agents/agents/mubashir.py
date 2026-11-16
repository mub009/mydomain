"""Agent 3 - Mubashir: the analyst. Merges Lotappi's and Mayavi's reports,
checks agreement, measures risk and prepares trade levels."""
from __future__ import annotations

from .base import Agent, clamp


class Mubashir(Agent):
    name = "Mubashir"
    role = "analyst who combines the short-term and 1-month reports and checks risk"

    def analyse_one(self, sym: str, lot: dict, may: dict, s: dict) -> dict:
        combined = 0.5 * lot["score"] + 0.5 * may["score"]
        notes = []

        agree = lot["score"] >= 60 and may["score"] >= 60
        conflict = not agree and abs(lot["score"] - may["score"]) > 25
        if agree:
            combined += 5; notes.append("Both Lotappi and Mayavi like it")
        if conflict:
            notes.append(f"Conflict: Lotappi {lot['score']:.0f} vs Mayavi {may['score']:.0f}")

        risk_pts = 0
        if s["atr_pct"] > 4: risk_pts += 1
        if s["volatility_21d"] > 45: risk_pts += 1
        if s["rsi"] > 75: risk_pts += 1
        risk = ["LOW", "MEDIUM", "HIGH", "HIGH"][risk_pts]
        combined -= 5 * risk_pts
        if risk_pts:
            notes.append(f"Risk {risk}: ATR {s['atr_pct']:.1f}% of price, volatility {s['volatility_21d']:.0f}%")

        # Which horizon fits best?
        if agree:
            horizon = "Both (swing now, hold ~1 month)"
        elif lot["score"] >= may["score"]:
            horizon = "Short-term swing (1-10 days)"
        else:
            horizon = "1-month positional"

        # Trade levels: wider stop for longer holding, 2:1 reward-to-risk target.
        mult = 1.5 if horizon.startswith("Short") else 2.5
        entry = s["close"]
        stop = entry - mult * s["atr"]
        target = entry + 2 * (entry - stop)

        return {
            "symbol": sym, "combined": round(clamp(combined), 1),
            "lotappi": lot["score"], "mayavi": may["score"],
            "agree": agree, "conflict": conflict, "risk": risk, "horizon": horizon,
            "entry": round(entry, 2), "stop_loss": round(stop, 2), "target": round(target, 2),
            "rsi": round(s["rsi"], 1), "ret_5d": round(s["ret_5d"], 2), "ret_21d": round(s["ret_21d"], 2),
            "reasons": lot["reasons"][:3] + may["reasons"][:3],
            "warnings": lot["warnings"] + may["warnings"],
            "notes": notes,
        }

    def run(self, snaps: dict[str, dict]) -> list[dict]:
        lot = {r["symbol"]: r for r in self.bus.latest(self.name, "Lotappi").payload}
        may = {r["symbol"]: r for r in self.bus.latest(self.name, "Mayavi").payload}
        rows = sorted((self.analyse_one(sym, lot[sym], may[sym], snaps[sym]) for sym in lot),
                      key=lambda r: r["combined"], reverse=True)

        agreed = [r["symbol"] for r in rows if r["agree"]]
        conflicts = [r["symbol"] for r in rows[:10] if r["conflict"]]
        lines = [f"Combined {len(rows)} stocks.",
                 f"Both agents agree on: {', '.join(agreed) or 'none'}",
                 f"Conflicts in top 10: {', '.join(conflicts) or 'none'}",
                 "Top combined scores:"]
        lines += [f"  {r['symbol']:<12} {r['combined']:5.1f}  risk {r['risk']:<6} {r['horizon']}" for r in rows[:8]]
        text = "\n".join(lines)
        note = self.explain("In 5-7 lines, explain where the short-term and 1-month views agree or "
                            "conflict, and which stocks look strongest after risk.", rows[:8])
        if note:
            text += f"\n\nMubashir's analysis: {note}"
        self.say("FinalDecision", "Combined analysis", text, rows)
        return rows

    def answer(self, question_payload: list[str], rows: list[dict]) -> dict[str, str]:
        """Reply to the Final Decision agent's questions about conflicted stocks."""
        by = {r["symbol"]: r for r in rows}
        answers = {}
        for sym in question_payload:
            r = by[sym]
            if r["lotappi"] > r["mayavi"]:
                answers[sym] = ("Trust the short-term view only: momentum is there but the monthly "
                                "trend is weak. Use the tight stop and book profits fast.")
            else:
                answers[sym] = ("Trust the 1-month view: trend is good but short-term timing is weak. "
                                "Wait for a dip or a fresh breakout before entering.")
        self.say("FinalDecision", "Re: conflicted stocks",
                 "\n".join(f"{k}: {v}" for k, v in answers.items()), answers)
        return answers
