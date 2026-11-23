import { describe, expect, it } from "vitest";
import { holdPlan } from "./forecast";
import { holdSentence, holdShort, shortDate } from "./hold";
import { addTradingDays } from "./market/calendar";
import type { Bar } from "./types";

/** A steady random walk with a small upward drift. */
function bars(n = 260, start = 100, step = 0.004): Bar[] {
  let p = start, seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.03;
  return Array.from({ length: n }, (_, i) => {
    p *= 1 + step / 4 + r();
    return { date: new Date(Date.UTC(2026, 0, 1) + i * 864e5).toISOString().slice(0, 10), open: p, high: p * 1.01, low: p * 0.99, close: p, volume: 1e6 };
  });
}

describe("holding plan", () => {
  it("counts trading days, skipping weekends and NSE holidays", () => {
    expect(addTradingDays("2026-11-20", 1)).toBe("2026-11-23"); // Fri -> Mon
    expect(addTradingDays("2026-11-23", 1)).toBe("2026-11-25"); // skips Guru Nanak Jayanti (24 Nov)
    expect(addTradingDays("2026-11-20", 10)).toBe("2026-12-07");
  });

  it("gives days to target, odds that add up, and a return between stop and target", () => {
    const b = bars(), last = b[b.length - 1].close;
    const h = holdPlan(b, { entry: last, stop: last * 0.95, target: last * 1.1, maxDays: 21, seed: "t" });
    expect(h.maxDays).toBe(21);
    expect(h.probTarget + h.probStop + h.probOpen).toBeCloseTo(100, 0);
    expect(h.expectedReturnPct).toBeGreaterThanOrEqual(-5.01);
    expect(h.expectedReturnPct).toBeLessThanOrEqual(10.01);
    if (h.expectedDays) expect(h.expectedDays).toBeGreaterThanOrEqual(1), expect(h.expectedDays).toBeLessThanOrEqual(21);
    expect(h.targetPct).toBeCloseTo(10, 1);
    expect(h.stopPct).toBeCloseTo(-5, 1);
  });

  it("is repeatable for the same seed", () => {
    const b = bars(), last = b[b.length - 1].close, o = { entry: last, stop: last * 0.97, target: last * 1.06, maxDays: 10, seed: "same" };
    expect(holdPlan(b, o)).toEqual(holdPlan(b, o));
  });

  it("a nearer target is reached sooner and more often", () => {
    const b = bars(), last = b[b.length - 1].close;
    const near = holdPlan(b, { entry: last, stop: last * 0.95, target: last * 1.03, maxDays: 21, seed: "x" });
    const far = holdPlan(b, { entry: last, stop: last * 0.95, target: last * 1.15, maxDays: 21, seed: "x" });
    expect(near.probTarget).toBeGreaterThan(far.probTarget);
    expect(near.expectedDays ?? 99).toBeLessThan(far.expectedDays ?? 99);
  });

  it("says it in words", () => {
    const h = { maxDays: 10, expectedDays: 6, daysRange: [4, 8] as [number, number], probTarget: 52.3, probStop: 30.1, probOpen: 17.6, expectedReturnPct: 2.4, targetPct: 6, stopPct: -3, expectedBy: "2026-11-30", exitBy: "2026-12-07" };
    expect(shortDate("2026-12-07")).toBe("7 Dec");
    expect(holdShort(h)).toBe("~6 days");
    expect(holdShort({ ...h, expectedDays: null })).toBe("up to 10 days");
    const s = holdSentence(h);
    expect(s).toContain("about 6 trading days (around 30 Nov; 4-8 days in most cases)");
    expect(s).toContain("until 7 Dec");
    expect(s).toContain("52.3% target first");
    expect(s).toContain("Expected return +2.4%");
  });
});
