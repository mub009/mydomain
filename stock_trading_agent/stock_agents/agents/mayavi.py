"""Agent 2 - Mayavi: short-month positional picker (about 1 month holding)."""
from __future__ import annotations

import math

from .base import Agent, clamp, short_list


class Mayavi(Agent):
    name = "Mayavi"
    role = "1-month positional trend scanner"

    def score(self, sym: str, s: dict, index_ret_21d: float) -> dict:
        pts, reasons, warnings = 25.0, [], []

        if s["close"] > s["sma20"] > s["sma50"]:
            pts += 20; reasons.append("Price > SMA20 > SMA50 (clean uptrend)")
        elif s["close"] > s["sma50"]:
            pts += 8; reasons.append("Price above SMA50")
        else:
            pts -= 10; warnings.append("Price below SMA50")

        if not math.isnan(s["sma200"]):
            if s["close"] > s["sma200"]:
                pts += 10; reasons.append("Above 200-day average (long trend up)")
            else:
                warnings.append("Below 200-day average")

        pts += clamp(s["ret_21d"] * 1.5, -15, 15)
        rs = s["ret_21d"] - index_ret_21d
        if rs > 0:
            pts += 10; reasons.append(f"Beating Nifty by {rs:.1f}% over 1 month")
        else:
            warnings.append(f"Lagging Nifty by {-rs:.1f}%")

        if s["macd"] > s["macd_signal"] and s["macd"] > 0:
            pts += 10; reasons.append("MACD bullish above zero")
        elif s["macd"] < s["macd_signal"]:
            pts -= 5

        r = s["rsi"]
        if 45 <= r <= 65:
            pts += 10; reasons.append(f"RSI {r:.0f} healthy")
        elif r > 72:
            pts -= 5; warnings.append(f"RSI {r:.0f} stretched")

        if s["close"] >= 0.9 * s["high_52w"]:
            pts += 5; reasons.append("Within 10% of 52-week high")

        pts = clamp(pts)
        signal = "BUY" if pts >= 65 else "WATCH" if pts >= 50 else "AVOID"
        return {"symbol": sym, "score": round(pts, 1), "signal": signal, "rel_strength": round(rs, 2),
                "reasons": reasons, "warnings": warnings, "horizon": "~1 month"}

    def run(self, snaps: dict[str, dict], index_ret_21d: float) -> list[dict]:
        reports = sorted((self.score(k, v, index_ret_21d) for k, v in snaps.items()),
                         key=lambda r: r["score"], reverse=True)
        text = (f"Scanned {len(reports)} stocks for 1-month holds (Nifty 1M: {index_ret_21d:+.1f}%). "
                f"Top picks:\n" + short_list(reports))
        note = self.explain("In 4-6 lines, summarise your best 1-month positional picks and the main risk.",
                            reports[:5])
        if note:
            text += f"\n\nMayavi's note: {note}"
        self.say("Mubashir", "1-month scan report", text, reports)
        return reports
