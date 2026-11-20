import { describe, expect, it } from "vitest";
import { ALL_CAPS } from "./market/universe";
import { runAnalysis } from "./pipeline";
import { stockConversation } from "./stock-dialogue";

describe("agents discussing one stock", () => {
  it("every agent speaks, numbers come through, and the verdict matches the analysis", async () => {
    const r = await runAnalysis({ symbols: ALL_CAPS.slice(0, 40), top: 5, demo: true, aiNotes: false, riskPerTrade: 1, capital: 500000 }, () => {});
    for (const d of [r.picks[0], r.all.find((x) => x.desk && x.blackPoints && !r.picks.includes(x)) ?? r.all[5], r.all[r.all.length - 1]].filter(Boolean)) {
      const msgs = stockConversation(d, r);
      const senders = new Set(msgs.map((m) => m.sender));
      for (const a of ["Research", "News", "Volatility", "Macro", "Momentum", "Trend", "Decision"]) expect(senders.has(a as never)).toBe(true);
      if (d.desk) for (const a of ["Performance", "Valuation", "Growth", "Profitability", "RedFlag"]) expect(senders.has(a as never)).toBe(true);
      if (d.blackPoints) expect(senders.has("BlackPoints")).toBe(true);
      const decision = msgs.find((m) => m.sender === "Decision" && m.kind === "decision")!;
      expect(decision.text.startsWith(`${d.symbol}: ${d.verdict}.`)).toBe(true);
      for (const m of msgs) expect(m.text).not.toMatch(/undefined|NaN|Infinity|\[object/);
      expect(msgs.every((m) => m.tickers.includes(d.symbol))).toBe(true);
    }
  });
});
