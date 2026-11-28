import { describe, expect, it } from "vitest";
import type { ExitAdvice } from "./exit-check";
import { commodityPicks, improvePortfolio, improveStock } from "./improve";
import type { Decision } from "./types";

const dec = (o: Record<string, unknown> = {}): Decision => ({ symbol: "ABC", sector: "IT", verdict: "BUY", combined: 70, entry: 90, chart: { zone: { low: 84, high: 88, plan: "Wait for dip" } }, ...o } as unknown as Decision);
const adv = (o: Partial<ExitAdvice> = {}): ExitAdvice => ({
  symbol: "ABC", sector: "IT", action: "HOLD", sellQty: 0, qty: 10, avgPrice: 100, price: 90, pnlPct: -10, pnl: -100, verdict: "BUY",
  reasons: ["Agents still rate it BUY"], stop: 85, target: 110, sources: ["Zerodha"],
  longTerm: { score: 80, action: "ACCUMULATE", grade: "Strong", pillars: [], summary: "" }, ...o,
});

describe("improve one holding", () => {
  it("suggests averaging down in the buy zone when the long-term case is strong", () => {
    const tips = improveStock(dec(), adv());
    const t = tips.find((x) => x.kind === "add")!;
    expect(t.title).toBe("Average down: add 5 shares near ₹86.00");
    expect(t.text).toContain("from ₹100.00 to ₹95.33"); // (100*10 + 86*5) / 15
    expect(tips.some((x) => x.kind === "protect")).toBe(true);
  });

  it("doesn't suggest buying below the stop-loss", () => {
    const tips = improveStock(dec(), adv({ stop: 87 })); // buy zone 84-88, middle 86, under the 87 stop
    expect(tips.some((x) => x.kind === "add")).toBe(false);
    expect(tips.find((x) => x.title === "Don't average down yet")!.text).toContain("below your stop-loss (₹87.00)");
  });

  it("never averages down a Sell, or a weak business", () => {
    expect(improveStock(dec(), adv({ action: "SELL", sellQty: 10, stop: undefined })).some((x) => x.kind === "add")).toBe(false);
    const weak = improveStock(dec(), adv({ longTerm: { score: 40, action: "REDUCE", grade: "Weak", pillars: [], summary: "" } }));
    expect(weak.some((x) => x.kind === "add")).toBe(false);
    expect(weak.find((x) => x.kind === "trim")!.title).toBe("Don't add to it");
  });

  it("flags a stock that is too big a share of the portfolio", () => {
    expect(improveStock(dec(), adv(), 32).some((x) => x.title.includes("32% of your portfolio"))).toBe(true);
  });

  it("explains commodity links", () => {
    const tips = improveStock(dec({ symbol: "ONGC", sector: "Energy" }), adv({ symbol: "ONGC", sector: "Energy" }));
    expect(tips.find((x) => x.kind === "commodity")!.title).toBe("Moves with crude oil (rises with it)");
    expect(improveStock(dec({ symbol: "XYZMET", sector: "Metals" }), adv()).find((x) => x.kind === "commodity")!.title).toBe("A commodity stock");
  });
});

describe("improve the portfolio", () => {
  const book = [
    adv({ symbol: "INFY", sector: "IT", qty: 50, price: 1000 }),
    adv({ symbol: "TCS", sector: "IT", qty: 10, price: 3000 }),
    adv({ symbol: "SUZLON", sector: "Capital Goods", qty: 100, price: 40, action: "SELL", sellQty: 100 }),
  ];
  it("weighs by value, finds concentration, sells, gold and commodity gaps", () => {
    const pf = improvePortfolio(book, [{ symbol: "HINDALCO", sector: "Metals", verdict: "BUY", why: "long term 75/100" }]);
    expect(pf.sectors[0]).toEqual({ sector: "IT", pct: expect.closeTo(95.2, 1) });
    expect(pf.weights[0].symbol).toBe("INFY");
    const titles = pf.tips.map((t) => t.title);
    expect(titles).toContain("Exit 1 weak holding: SUZLON");
    expect(titles.some((t) => t.startsWith("95% in IT"))).toBe(true);
    expect(titles).toContain("No gold for balance");
    expect(titles).toContain("Commodity stocks the agents rate well today");
    expect(pf.goldPct).toBe(0);
  });

  it("counts gold ETFs and commodity stocks", () => {
    const pf = improvePortfolio([adv({ symbol: "GOLDBEES", sector: "ETF", qty: 100, price: 70 }), adv({ symbol: "TATASTEEL", sector: "Metals", qty: 100, price: 160 })]);
    expect(pf.goldPct).toBeCloseTo(30.4, 0);
    expect(pf.commodityPct).toBeCloseTo(69.6, 0);
    expect(pf.tips.some((t) => t.title === "No gold for balance")).toBe(false);
  });

  it("picks commodity stocks rated BUY or better", () => {
    const picks = commodityPicks([
      { symbol: "HINDALCO", sector: "Metals", verdict: "BUY", combined: 70 }, { symbol: "ONGC", sector: "Energy", verdict: "WATCH", combined: 55 },
      { symbol: "INFY", sector: "IT", verdict: "STRONG BUY", combined: 90 },
    ] as unknown as Decision[]);
    expect(picks.map((p) => p.symbol)).toEqual(["HINDALCO"]);
  });
});
