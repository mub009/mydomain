import { describe, expect, it } from "vitest";
import { bottomSetup, LONG_SWING } from "./bottom";
import { DecisionAgent } from "./agents/decision";
import { holdDays } from "./pipeline";
import { matchesTrade } from "./stock-view";
import { shortlist, rankQuick, quickRow } from "./market/prescreen";
import type { Bar, Decision } from "./types";

/** Bars from a list of closes, with a small daily range; volume can be set per bar. */
function bars(closes: number[], vol = (_i: number, up: boolean) => (up ? 1.5e6 : 1e6)): Bar[] {
  return closes.map((c, i) => {
    const up = i > 0 && c >= closes[i - 1];
    const d = new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10);
    return { date: d, open: c, high: c * 1.01, low: c * 0.99, close: c, volume: vol(i, up) };
  });
}

/** 200 → 100 over 170 days, a base, then a steady climb to ~115 with a higher low. */
function turningUp(): number[] {
  const down = Array.from({ length: 170 }, (_, i) => 200 - (100 * i) / 169 + Math.sin(i / 3) * 2);
  const base = Array.from({ length: 15 }, (_, i) => 100 + Math.sin(i) * 1.5);
  const climb = Array.from({ length: 35 }, (_, i) => 101 + i * 0.45 + Math.sin(i / 2) * 0.8);
  return [...down, ...base, ...climb];
}

describe("long swing: turning up from a bottom", () => {
  it("finds a stock bouncing off its low with a higher low", () => {
    const b = bottomSetup(bars(turningUp()))!;
    expect(b.isSetup).toBe(true);
    expect(b.score).toBeGreaterThanOrEqual(70);
    expect(b.offLowPct).toBeGreaterThan(3);
    expect(b.offHighPct).toBeGreaterThan(15);
    expect(b.stopLoss).toBeLessThan(b.entry);
    expect(b.target).toBeGreaterThan(b.entry + 1.9 * (b.entry - b.stopLoss));
    expect(b.signals.join(" ")).toMatch(/Bounced/);
  });

  it("is not a setup near the 52-week high", () => {
    const b = bottomSetup(bars(Array.from({ length: 250 }, (_, i) => 100 + i * 0.4)))!;
    expect(b.isSetup).toBe(false);
    expect(b.warnings[0]).toMatch(/52-week high/);
  });

  it("is not a setup while still making new lows", () => {
    const b = bottomSetup(bars(Array.from({ length: 250 }, (_, i) => 300 - i)))!;
    expect(b.isSetup).toBe(false);
  });

  it("needs about 6 months of prices", () => {
    expect(bottomSetup(bars(turningUp().slice(-100)))).toBeNull();
  });

  it("holds long swings for up to ~3 months", () => {
    expect(holdDays(LONG_SWING)).toBe(60);
    expect(holdDays("Swing · 1-10 days")).toBe(10);
  });
});

const dec = (symbol: string, sector: string, score: number, extra: Partial<Decision> = {}): Decision => ({
  symbol, sector, combined: 40, lotappi: 30, mayavi: 40, agree: false, conflict: false, risk: "LOW", horizon: "Positional · ~1 month",
  entry: 100, stopLoss: 95, target: 110, rsi: 50, ret5d: 1, ret21d: 2, volRatio: 1, atrPct: 2,
  lotReasons: [], lotWarnings: [], mayReasons: [], mayWarnings: [], notes: [], verdict: "WATCH", spark: [],
  bottom: { score, isSetup: score >= 70, low: 90, lowDate: "2025-06-01", offLowPct: 11, offHighPct: 30, high52w: 150, signals: ["Bounced"], warnings: [], entry: 100, stopLoss: 88, target: 125 },
  ...extra,
});

describe("Decision Agent's long swing list", () => {
  it("ranks by the bottom score, uses its own plan and skips weak or risky stocks", () => {
    const out = new DecisionAgent().longSwing([
      dec("A", "IT", 75), dec("B", "Banks", 90), dec("C", "Auto", 55),
      dec("LOSS", "FMCG", 95, { fundamentals: { cap: "Mid", epsTTM: -2 } as never }),
      dec("FLAG", "Pharma", 95, { desk: { severe: true } as never }),
    ], 5);
    expect(out.map((d) => d.symbol)).toEqual(["B", "A"]);
    expect(out[0]).toMatchObject({ horizon: LONG_SWING, entry: 100, stopLoss: 88, target: 125, verdict: "BUY" });
    expect(out[1].verdict).toBe("WATCH");
  });

  it("keeps the sector cap", () => {
    const out = new DecisionAgent().longSwing([dec("A", "IT", 90), dec("B", "IT", 85), dec("C", "IT", 80)], 5);
    expect(out).toHaveLength(2);
  });

  it("filters by trade type", () => {
    expect(matchesTrade(dec("A", "IT", 90), "Long swing")).toBe(true);
    expect(matchesTrade(dec("A", "IT", 30), "Long swing")).toBe(false);
    expect(matchesTrade({ horizon: "Swing · 1-10 days" }, "Short swing")).toBe(true);
    expect(matchesTrade({ horizon: "Swing, then hold ~1 month" }, "Positional")).toBe(true);
    expect(matchesTrade({ horizon: "Positional · ~1 month" }, "Short swing")).toBe(false);
  });
});

describe("quick scan keeps bottom candidates", () => {
  it("adds stocks turning up from a bottom to the strongest", () => {
    const strong = Array.from({ length: 30 }, (_, k) => quickRow(`UP${k}`, { close: Array.from({ length: 250 }, (_, i) => 100 + i * (0.3 + k / 100)), volume: 1e6 })!);
    const bottom = quickRow("BOTTOM", { close: turningUp(), volume: 1e6 })!;
    expect(bottom.bottom).toBeGreaterThanOrEqual(70);
    const { rows, bottoms } = shortlist(rankQuick([...strong, bottom]), 12);
    expect(rows.map((r) => r.symbol)).toContain("BOTTOM");
    expect(bottoms).toBe(1);
    expect(rows).toHaveLength(12);
  });
});

describe("minimum profit to target", () => {
  const buy = (symbol: string, target: number, extra: Partial<Decision> = {}) =>
    dec(symbol, symbol, 10, { verdict: "STRONG BUY", combined: 80, agree: true, entry: 100, stopLoss: 95, target, bottom: undefined, ...extra });

  it("leaves out picks whose target is below the minimum, with the reason", () => {
    const a = new DecisionAgent(11);
    const rows = [buy("A", 112), buy("B", 108), buy("C", 111)].map(({ verdict: _v, spark: _s, ...r }) => r);
    const { picks, passed } = a.decide(rows, {}, 5, {});
    expect(picks.map((p) => p.symbol)).toEqual(["A", "C"]);
    expect(passed[0]).toMatchObject({ symbol: "B", passedOver: "Target only +8.0%, below the 11% minimum profit" });
  });

  it("can be switched off", () => {
    const rows = [buy("A", 105)].map(({ verdict: _v, spark: _s, ...r }) => r);
    expect(new DecisionAgent(0).decide(rows, {}, 5, {}).picks).toHaveLength(1);
  });

  it("applies to long swings too", () => {
    const low = dec("LOW", "IT", 90, { bottom: { ...dec("X", "IT", 90).bottom!, entry: 100, target: 108 } });
    const ok = dec("OK", "Banks", 85);
    expect(new DecisionAgent(11).longSwing([low, ok], 5).map((d) => d.symbol)).toEqual(["OK"]);
  });
});
