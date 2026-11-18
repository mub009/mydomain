/** Agent 1 - Momentum: short-term hunter (swing trades, 1-10 trading days). */
import type { AgentReport, Snapshot } from "../types";
import { byScore, clamp, round, signalFor } from "./base";

export class MomentumAgent {

  score(symbol: string, s: Snapshot): AgentReport {
    let pts = 30;
    const reasons: string[] = [], warnings: string[] = [];

    if (s.ema9 > s.ema21) { pts += 15; reasons.push("EMA9 above EMA21 (short uptrend)"); }
    else { pts -= 5; warnings.push("EMA9 below EMA21"); }

    const r = s.rsi;
    if (r >= 50 && r <= 70) { pts += 15; reasons.push(`RSI ${r.toFixed(0)} in momentum zone`); }
    else if (r >= 40 && r < 50) pts += 5;
    else if (r > 75) { pts -= 10; warnings.push(`RSI ${r.toFixed(0)} overbought`); }
    else if (r < 30) { pts += 5; reasons.push(`RSI ${r.toFixed(0)} oversold - bounce possible`); }

    if (s.close > s.high20) { pts += 15; reasons.push("Breakout above 20-day high"); }

    if (s.volRatio >= 1.5 && s.ret1d > 0) { pts += 15; reasons.push(`Volume ${s.volRatio.toFixed(1)}x average on an up day`); }
    else if (s.volRatio >= 1.5 && s.ret1d < 0) { pts -= 10; warnings.push("Heavy selling volume"); }

    if (s.macdHist > s.macdHistPrev) { pts += 10; reasons.push("MACD histogram rising"); }

    pts += clamp(s.ret5d * 2, -10, 10);
    if (s.ret5d > 0) reasons.push(`+${s.ret5d.toFixed(1)}% in 5 days`);

    const score = round(clamp(pts));
    return { symbol, score, signal: signalFor(score), reasons, warnings, horizon: "1-10 days" };
  }

  scan(snaps: Record<string, Snapshot>): AgentReport[] {
    return Object.entries(snaps).map(([k, v]) => this.score(k, v)).sort(byScore);
  }
}
