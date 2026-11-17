import { describe, expect, it } from "vitest";
import { rsi, snapshot } from "./indicators";
import { marketStatus } from "./market/calendar";
import { demoBars } from "./market/demo";
import { NIFTY50 } from "./market/universe";
import { inr } from "./format";
import { runAnalysis } from "./pipeline";
import type { Message, StreamEvent } from "./types";

describe("indicators and demo data", () => {
  it("RSI stays between 0 and 100", () => {
    const r = rsi(demoBars("TCS", 1).map((b) => b.close));
    expect(r.every((x) => x >= 0 && x <= 100)).toBe(true);
  });
  it("snapshot has the fields agents use", () => {
    const s = snapshot(demoBars("INFY", 1));
    for (const k of ["close", "rsi", "sma50", "atr", "ret21d", "volRatio"] as const) expect(Number.isFinite(s[k])).toBe(true);
  });
  it("demo data is deterministic per seed and differs across seeds", () => {
    expect(demoBars("SBIN", 7).map((b) => b.close)).toEqual(demoBars("SBIN", 7).map((b) => b.close));
    expect(demoBars("SBIN", 7)[259].close).not.toEqual(demoBars("SBIN", 8)[259].close);
  });
  it("has 50 Nifty stocks", () => expect(NIFTY50).toHaveLength(50));
});

describe("formatting and calendar", () => {
  it("formats rupees with Indian grouping", () => expect(inr(275000, 0)).toBe("₹2,75,000"));
  it("knows NSE hours, weekends and holidays (IST)", () => {
    expect(marketStatus(new Date("2026-11-17T05:00:00Z")).open).toBe(true); // Tue 10:30 IST
    expect(marketStatus(new Date("2026-11-17T11:00:00Z")).label).toBe("Closed"); // Tue 16:30 IST
    expect(marketStatus(new Date("2026-11-14T05:00:00Z")).label).toBe("Weekend"); // Sat
    expect(marketStatus(new Date("2026-12-25T05:00:00Z")).label).toBe("Holiday");
    expect(marketStatus(new Date("2026-11-17T03:40:00Z")).label).toBe("Pre-open"); // 09:10 IST
  });
});

async function run(capital?: number, top = 5) {
  const events: StreamEvent[] = [];
  const result = await runAnalysis({ symbols: NIFTY50, top, demo: true, aiNotes: false, capital, riskPerTrade: 1 }, (e) => events.push(e));
  const messages = events.filter((e) => e.type === "message").map((e) => (e as { message: Message }).message);
  return { result, messages, events };
}

describe("four agents", () => {
  it("runs end to end on demo data", async () => {
    const { result: res, messages, events } = await run(500000);
    expect(res.source.kind).toBe("demo");
    expect(res.all).toHaveLength(50);
    expect(res.picks.length).toBeLessThanOrEqual(5);
    expect(events[events.length - 1].type).toBe("result");
    for (const d of res.all) {
      expect(["STRONG BUY", "BUY", "WATCH", "AVOID"]).toContain(d.verdict);
      expect(d.stopLoss).toBeLessThan(d.entry);
      // Target = Entry + 2 x (Entry - Stop-loss)
      expect(d.target).toBeCloseTo(d.entry + 2 * (d.entry - d.stopLoss), 1);
      expect(d.agree && d.conflict).toBe(false);
      expect(d.spark.length).toBeGreaterThan(0);
    }
    for (const p of res.picks) expect(["STRONG BUY", "BUY"]).toContain(p.verdict);
    const threads = new Set(messages.map((m) => m.thread));
    for (const t of ["Lotappi|Mayavi", "Lotappi|Mubashir", "Mayavi|Mubashir", "FinalDecision|Mubashir", "team"]) expect(threads).toContain(t);
    expect(messages.some((m) => m.kind === "decision" && m.to === "ALL")).toBe(true);
    expect(messages.map((m) => m.stage)).toEqual([...messages.map((m) => m.stage)].sort(
      (a, b) => ["scan", "analyze", "debate", "decide"].indexOf(a) - ["scan", "analyze", "debate", "decide"].indexOf(b)));
    for (const m of messages) expect(m.text).not.toMatch(/undefined|NaN/);
  });

  it("sizes positions by risk and never allocates more than the capital", async () => {
    for (const capital of [20000, 500000]) {
      const { result: res } = await run(capital, 10);
      const total = res.picks.reduce((s, p) => s + (p.investment ?? 0), 0);
      expect(total).toBeLessThanOrEqual(capital);
      for (const p of res.picks) {
        expect(p.quantity).toBeLessThanOrEqual(Math.floor((capital * 0.01) / (p.entry - p.stopLoss)));
        expect(p.quantity).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("never picks more than 2 stocks from one sector", async () => {
    for (let i = 0; i < 5; i++) {
      const { result: res } = await run(undefined, 15);
      const count: Record<string, number> = {};
      for (const p of res.picks) count[p.sector] = (count[p.sector] ?? 0) + 1;
      for (const n of Object.values(count)) expect(n).toBeLessThanOrEqual(2);
    }
  });

  it("different demo runs reach different conclusions", async () => {
    const sets = new Set<string>();
    for (let i = 0; i < 4; i++) sets.add((await run()).result.picks.map((p) => p.symbol).join(","));
    expect(sets.size).toBeGreaterThan(1);
  });
});
