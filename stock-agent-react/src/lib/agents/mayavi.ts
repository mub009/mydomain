/** Agent 2 - Mayavi: short-month positional picker (about 1 month). */
import type { AgentReport, Snapshot } from "../types";
import { Agent, clamp, round, shortList, signalFor } from "./base";

export class Mayavi extends Agent {
  name = "Mayavi" as const;
  role = "1-month positional trend scanner";

  score(symbol: string, s: Snapshot, indexRet21d: number): AgentReport {
    let pts = 25;
    const reasons: string[] = [], warnings: string[] = [];

    if (s.close > s.sma20 && s.sma20 > s.sma50) { pts += 20; reasons.push("Price > SMA20 > SMA50 (clean uptrend)"); }
    else if (s.close > s.sma50) { pts += 8; reasons.push("Price above SMA50"); }
    else { pts -= 10; warnings.push("Price below SMA50"); }

    if (!Number.isNaN(s.sma200)) {
      if (s.close > s.sma200) { pts += 10; reasons.push("Above 200-day average (long trend up)"); }
      else warnings.push("Below 200-day average");
    }

    pts += clamp(s.ret21d * 1.5, -15, 15);
    const rs = s.ret21d - indexRet21d;
    if (rs > 0) { pts += 10; reasons.push(`Beating Nifty by ${rs.toFixed(1)}% over 1 month`); }
    else warnings.push(`Lagging Nifty by ${(-rs).toFixed(1)}%`);

    if (s.macd > s.macdSignal && s.macd > 0) { pts += 10; reasons.push("MACD bullish above zero"); }
    else if (s.macd < s.macdSignal) pts -= 5;

    const r = s.rsi;
    if (r >= 45 && r <= 65) { pts += 10; reasons.push(`RSI ${r.toFixed(0)} healthy`); }
    else if (r > 72) { pts -= 5; warnings.push(`RSI ${r.toFixed(0)} stretched`); }

    if (s.close >= 0.9 * s.high52w) { pts += 5; reasons.push("Within 10% of 52-week high"); }

    const score = round(clamp(pts));
    return { symbol, score, signal: signalFor(score), reasons, warnings, horizon: "~1 month" };
  }

  async run(snaps: Record<string, Snapshot>, indexRet21d: number): Promise<AgentReport[]> {
    const reports = Object.entries(snaps).map(([k, v]) => this.score(k, v, indexRet21d)).sort((a, b) => b.score - a.score);
    const text = `Scanned ${reports.length} stocks for 1-month holds (Nifty 1M: ${indexRet21d >= 0 ? "+" : ""}${indexRet21d.toFixed(1)}%). Top picks:\n${shortList(reports)}`;
    const note = await this.explain("In 4-6 lines, summarise your best 1-month positional picks and the main risk.", reports.slice(0, 5));
    this.bus.send(this.name, "Mubashir", "1-month scan report", text, reports, note);
    return reports;
  }
}
