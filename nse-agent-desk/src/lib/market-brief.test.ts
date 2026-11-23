import { describe, expect, it } from "vitest";
import { arrange, indexReasons, metalReasons } from "./market-brief";

describe("market brief reasons", () => {
  const fall = indexReasons({
    changePct: -1.75,
    asia: [{ name: "Hang Seng", pct: -0.12 }, { name: "KOSPI", pct: -3.31 }],
    us: { spx: -3.7, nasdaq: -5.28, date: "2026-11-20" },
    sectors: [{ name: "Nifty Metal", changePct: -3.68 }, { name: "Nifty Bank", changePct: -3.17 }, { name: "Nifty IT", changePct: -0.9 }, { name: "Nifty FMCG", changePct: 0.8 }],
    mood: { date: "2026-11-23", stock_breadth: { up: 813, down: 2143, unchanged: 50, up_pct: 27, reading: "", stocks: 3006 } },
    vixPct: 2.2, crudePct: -4.8, inrPct: -0.42,
  });

  it("explains a fall with what pushed it down, and lists what pushed the other way", () => {
    const { reasons, against } = arrange(-1.75, fall);
    expect(reasons[0]).toBe("Nifty Metal -3.68%, Nifty Bank -3.17%, Nifty IT -0.90% dragged the most");
    expect(reasons).toContain("Wall Street fell in its previous session (2026-11-20): S&P 500 -3.70%, Nasdaq -5.28%");
    expect(reasons.some((r) => r.startsWith("813 stocks rose and 2,143 fell"))).toBe(true);
    expect(against.some((r) => r.startsWith("Brent crude fell 4.8%"))).toBe(true);
    expect(against.join(" ")).not.toContain("Wall Street");
  });

  it("leaves out small moves and a mixed market breadth", () => {
    const rs = indexReasons({ changePct: 0.2, asia: [{ name: "KOSPI", pct: 0.1 }], us: { spx: 0.2 }, sectors: [], mood: { date: "", stock_breadth: { up: 1500, down: 1450, unchanged: 0, up_pct: 51, reading: "", stocks: 2950 } }, vixPct: 1, crudePct: 0.5, inrPct: 0.05 });
    expect(rs).toEqual([]);
  });

  it("gold: a stronger dollar, higher yields and rising stocks work against it; a weaker rupee lifts the rupee price", () => {
    const rs = metalReasons({ name: "Gold", changePct: 1.2, usdPct: 0.8, dxyPct: 0.4, yieldChange: 0.06, inrPct: 0.4, stocksPct: 1.5 });
    const { reasons, against } = arrange(1.2, rs);
    expect(reasons[0]).toBe("International gold rose 0.80% in dollars");
    expect(reasons.some((r) => r.startsWith("The rupee weakened"))).toBe(true);
    expect(against.some((r) => r.startsWith("Stock markets rose") || r.startsWith("The US dollar strengthened") || r.startsWith("US 10-year bond yields rose"))).toBe(true);
  });

  it("gold as a safe haven when stocks fall", () => {
    const { reasons } = arrange(0.9, metalReasons({ name: "Gold", changePct: 0.9, usdPct: 0.9, stocksPct: -2 }));
    expect(reasons).toContain("Stock markets fell (S&P 500 -2.00%): investors moved to safe havens like gold");
  });
});
