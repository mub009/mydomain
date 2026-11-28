import { describe, expect, it } from "vitest";
import { exitAdvice, mergeHoldings } from "./exit-check";
import type { Decision } from "./types";

/** A healthy, buy-rated stock at ₹100; override what a test needs. */
const dec = (o: Partial<Decision> & Record<string, unknown> = {}): Decision => ({
  symbol: "ABC", sector: "IT", combined: 72, lotappi: 70, mayavi: 75, agree: true, conflict: false, risk: "LOW", horizon: "Swing · 1-10 days",
  entry: 100, stopLoss: 95, target: 110, rsi: 58, ret5d: 1, ret21d: 4, volRatio: 1.1, atrPct: 2, lotReasons: [], lotWarnings: [], mayReasons: [], mayWarnings: [],
  notes: [], verdict: "BUY", spark: [], ...o,
} as unknown as Decision);
const held = (avgPrice: number, qty = 10) => ({ qty, avgPrice, sources: ["Zerodha AB1234"] });

describe("sell check", () => {
  it("holds a healthy stock and gives the stop-loss to keep", () => {
    const a = exitAdvice(dec(), held(98));
    expect(a.action).toBe("HOLD");
    expect(a.sellQty).toBe(0);
    expect(a.stop).toBeGreaterThan(0);
    expect(a.reasons[0]).toContain("still rate it BUY");
  });

  it("sells on a verified Black Points red flag, whatever the scores", () => {
    const a = exitAdvice(dec({ blackPoints: { status: { swing: "Excluded", positional: "Excluded" }, findings: [{ materiality: "material", flag: "SEBI order against promoters" }] } as never }), held(90));
    expect(a.action).toBe("SELL");
    expect(a.sellQty).toBe(10);
    expect(a.reasons[0]).toContain("sebi order");
    expect(a.stop).toBeUndefined();
  });

  it("cuts a loss past the stop-loss when the agents aren't positive (8%, or 3 days' range if larger)", () => {
    expect(exitAdvice(dec({ entry: 91, verdict: "WATCH" }), held(100)).action).toBe("SELL"); // -9% > 8%
    expect(exitAdvice(dec({ entry: 93, verdict: "WATCH" }), held(100)).action).toBe("HOLD"); // -7%
    expect(exitAdvice(dec({ entry: 89, atrPct: 4, verdict: "WATCH" }), held(100)).action).toBe("HOLD"); // volatile stock: 12% allowed
    expect(exitAdvice(dec({ entry: 91, verdict: "BUY", mayavi: 40 }), held(100)).action).toBe("SELL"); // BUY but the trend is weak
  });

  it("past the stop-loss but still rated BUY with the trend holding: hold with a fresh, tighter stop", () => {
    const a = exitAdvice(dec({ entry: 80, stopLoss: 76, verdict: "STRONG BUY", mayavi: 70 }), held(100));
    expect(a.action).toBe("HOLD");
    expect(a.reasons[0]).toContain("past a 8% stop-loss");
    expect(a.stop).toBeLessThan(80);
    expect(a.stop).toBeGreaterThanOrEqual(76);
  });

  it("sells when the trend has broken", () => {
    const a = exitAdvice(dec({ verdict: "AVOID", lotappi: 30, mayavi: 25, ret21d: -9, combined: 28 }), held(101));
    expect(a.action).toBe("SELL");
    expect(a.reasons[0]).toContain("Trend has broken");
  });

  it("books half the profit when a big gain loses momentum", () => {
    const a = exitAdvice(dec({ entry: 130, lotappi: 42 }), held(100, 25));
    expect(a.action).toBe("BOOK PROFIT");
    expect(a.sellQty).toBe(12);
    expect(a.stop).toBeGreaterThanOrEqual(100); // stop raised to at least break-even
  });

  it("keeps holding a big gain while momentum is strong", () => {
    expect(exitAdvice(dec({ entry: 130, lotappi: 80, rsi: 65 }), held(100)).action).toBe("HOLD");
  });

  it("merges the same stock from several places at the weighted buy price", () => {
    const m = mergeHoldings([
      { symbol: "infy", qty: 10, avgPrice: 1400, source: "Zerodha A" },
      { symbol: "INFY", qty: 30, avgPrice: 1600, source: "Zerodha B" },
      { symbol: "TCS-EQ", qty: 2, avgPrice: 4000, source: "Added" },
      { symbol: "BAD", qty: 0, avgPrice: 10, source: "x" },
    ]);
    expect(m.get("INFY")).toEqual({ qty: 40, avgPrice: 1550, sources: ["Zerodha A", "Zerodha B"] });
    expect(m.has("TCS")).toBe(true);
    expect(m.has("BAD")).toBe(false);
  });
});
