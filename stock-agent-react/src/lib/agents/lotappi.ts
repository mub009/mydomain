/** Agent 1 - Lotappi: short-term hunter (swing trades, 1-10 trading days). */
import type { AgentReport, Snapshot } from "../types";
import { Agent, clamp, round, shortList, signalFor } from "./base";

export class Lotappi extends Agent {
  name = "Lotappi" as const;
  role = "short-term (1-10 day) swing-trade scanner";

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

  async run(snaps: Record<string, Snapshot>): Promise<AgentReport[]> {
    const reports = Object.entries(snaps).map(([k, v]) => this.score(k, v)).sort((a, b) => b.score - a.score);
    const text = `Scanned ${reports.length} stocks for short-term trades. Top picks:\n${shortList(reports)}`;
    const note = await this.explain("In 4-6 lines, summarise your best short-term setups and the main risk.", reports.slice(0, 5));
    this.bus.send(this.name, "Mubashir", "Short-term scan report", text, reports, note);
    return reports;
  }
}
