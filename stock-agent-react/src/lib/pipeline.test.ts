import { describe, expect, it } from "vitest";
import { fetchDemo, NIFTY50 } from "./data";
import { rsi, snapshot } from "./indicators";
import { runAgents } from "./pipeline";

describe("indicators", () => {
  it("RSI stays between 0 and 100", () => {
    const r = rsi(fetchDemo("TCS").map((b) => b.close));
    expect(r.every((x) => x >= 0 && x <= 100)).toBe(true);
  });
  it("snapshot has the fields agents use", () => {
    const s = snapshot(fetchDemo("INFY"));
    for (const k of ["close", "rsi", "sma50", "atr", "ret21d", "volRatio"] as const) expect(Number.isFinite(s[k])).toBe(true);
  });
  it("demo data is deterministic", () => {
    expect(fetchDemo("SBIN")).toEqual(fetchDemo("SBIN"));
  });
});

describe("four agents", () => {
  it("runs end to end on demo data", async () => {
    const seen: string[] = [];
    const res = await runAgents({
      symbols: NIFTY50.slice(0, 15), top: 3, demo: true, useAI: false, capital: 100000,
      onMessage: (m) => seen.push(m.sender),
    });
    expect(res.mode).toBe("demo");
    expect(res.all).toHaveLength(15);
    expect(res.picks.length).toBeLessThanOrEqual(3);
    for (const d of res.all) {
      expect(["STRONG BUY", "BUY", "WATCH", "AVOID"]).toContain(d.verdict);
      expect(d.stopLoss).toBeLessThan(d.entry);
      expect(d.target).toBeGreaterThan(d.entry);
      expect(d.investment!).toBeLessThanOrEqual(100000 * 0.2);
      expect(d.agree && d.conflict).toBe(false);
    }
    for (const p of res.picks) expect(["STRONG BUY", "BUY"]).toContain(p.verdict);
    for (const a of ["Lotappi", "Mayavi", "Mubashir", "FinalDecision"]) expect(seen).toContain(a);
    // one-to-one threads exist, and the decision goes to the team room
    const threads = new Set(res.conversation.map((m) => m.thread));
    for (const t of ["Lotappi|Mayavi", "Lotappi|Mubashir", "Mayavi|Mubashir", "FinalDecision|Mubashir", "team"]) expect(threads).toContain(t);
    expect(res.conversation.some((m) => m.kind === "decision" && m.to === "ALL")).toBe(true);
    // no "undefined"/"NaN" leaks into chat text
    for (const m of res.conversation) expect(m.text).not.toMatch(/undefined|NaN/);
    for (const d of res.all) expect(d.spark.length).toBeGreaterThan(0);
  });
});
