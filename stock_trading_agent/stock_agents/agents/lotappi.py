"""Agent 1 - Lotappi: short-term hunter (swing trades, about 1-10 trading days)."""
from __future__ import annotations

from .base import Agent, clamp, short_list


class Lotappi(Agent):
    name = "Lotappi"
    role = "short-term (1-10 day) swing-trade scanner"

    def score(self, sym: str, s: dict) -> dict:
        pts, reasons, warnings = 30.0, [], []

        if s["ema9"] > s["ema21"]:
            pts += 15; reasons.append("EMA9 above EMA21 (short uptrend)")
        else:
            pts -= 5; warnings.append("EMA9 below EMA21")

        r = s["rsi"]
        if 50 <= r <= 70:
            pts += 15; reasons.append(f"RSI {r:.0f} in momentum zone")
        elif 40 <= r < 50:
            pts += 5
        elif r > 75:
            pts -= 10; warnings.append(f"RSI {r:.0f} overbought")
        elif r < 30:
            pts += 5; reasons.append(f"RSI {r:.0f} oversold - bounce possible")

        if s["close"] > s["high_20"]:
            pts += 15; reasons.append("Breakout above 20-day high")

        if s["vol_ratio"] >= 1.5 and s["ret_1d"] > 0:
            pts += 15; reasons.append(f"Volume {s['vol_ratio']:.1f}x average on an up day")
        elif s["vol_ratio"] >= 1.5 and s["ret_1d"] < 0:
            pts -= 10; warnings.append("Heavy selling volume")

        if s["macd_hist"] > s["macd_hist_prev"]:
            pts += 10; reasons.append("MACD histogram rising")

        pts += clamp(s["ret_5d"] * 2, -10, 10)
        if s["ret_5d"] > 0:
            reasons.append(f"+{s['ret_5d']:.1f}% in 5 days")

        pts = clamp(pts)
        signal = "BUY" if pts >= 65 else "WATCH" if pts >= 50 else "AVOID"
        return {"symbol": sym, "score": round(pts, 1), "signal": signal,
                "reasons": reasons, "warnings": warnings, "horizon": "1-10 days"}

    def run(self, snaps: dict[str, dict]) -> list[dict]:
        reports = sorted((self.score(k, v) for k, v in snaps.items()),
                         key=lambda r: r["score"], reverse=True)
        text = f"Scanned {len(reports)} stocks for short-term trades. Top picks:\n" + short_list(reports)
        note = self.explain("In 4-6 lines, summarise your best short-term setups and the main risk.",
                            reports[:5])
        if note:
            text += f"\n\nLotappi's note: {note}"
        self.say("Mubashir", "Short-term scan report", text, reports)
        return reports
