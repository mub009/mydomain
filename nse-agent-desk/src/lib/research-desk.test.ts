import { describe, expect, it } from "vitest";
import { ALL_CAPS } from "./market/universe";
import { runAnalysis } from "./pipeline";
import { cagr, expectedReturn, fiveYearCagr, growthView, performanceView, valuationView, ytdReturn } from "./research-desk";
import type { Bar, Fundamentals, Message } from "./types";

const bar = (date: string, close: number): Bar => ({ date, open: close, high: close, low: close, close, volume: 0 });
const f = (o: Partial<Fundamentals>): Fundamentals => ({ cap: "Large", epsHistory: [], source: "t", sample: true, ...o });

describe("research desk maths", () => {
  it("CAGR", () => {
    expect(cagr(100, 200, 5)).toBeCloseTo(14.9, 1);
    expect(cagr(100, 133.1, 3)).toBe(10);
    expect(cagr(-5, 100, 3)).toBeUndefined();
    expect(cagr(100, 0, 3)).toBeUndefined();
  });

  it("YTD return from the last close of the previous year", () => {
    expect(ytdReturn([bar("2025-12-30", 90), bar("2025-12-31", 100), bar("2026-01-02", 105), bar("2026-11-17", 120)])).toBe(20);
    expect(ytdReturn([bar("2026-01-02", 105), bar("2026-11-17", 120)])).toBeUndefined();
  });

  it("5-year annualised return needs about five years of bars", () => {
    const long = [bar("2021-11-15", 100), bar("2023-11-15", 150), bar("2026-11-16", 200)];
    expect(fiveYearCagr(long).value).toBeCloseTo(14.9, 0);
    expect(fiveYearCagr([bar("2024-11-15", 100), bar("2026-11-16", 200)]).value).toBeUndefined();
  });

  it("expected return: analyst target first, otherwise an earnings-based estimate", () => {
    expect(expectedReturn({ price: 100, target: { mean: 120, analysts: 12 } })).toMatchObject({ value: 20, note: "mean target of 12 analysts" });
    // 12% earnings growth, P/E 20 vs sector 25 -> +2.5 for valuation
    expect(expectedReturn({ price: 100, epsCagr: 12, pe: 20, sectorPe: 25 }).value).toBe(14.5);
    expect(expectedReturn({ price: 100, epsCagr: 60 }).value).toBe(25); // capped
  });

  it("performance points", () => {
    const v = performanceView({ ytd: 25, niftyYtd: 10, five: { value: 18, years: 5 }, expected: { label: "Expected 1Y", unit: "%", value: 16 } });
    expect(v.points).toBe(3);
    expect(v.verdict).toBe("Outperformer");
    expect(performanceView({ ytd: -15, niftyYtd: 5, five: { value: -3, years: 5 }, expected: { label: "Expected 1Y", unit: "%", value: -4 } }).points).toBe(-3);
  });

  it("valuation: P/E against the sector, P/B and P/CFO", () => {
    const v = valuationView({ price: 200, f: f({ epsTTM: 10, marketCapCr: 20000 }), latest: { year: "FY26", equity: 5000, operatingCashFlow: 1000 }, sectorPe: 30, financial: false });
    expect(v.metrics.map((m) => m.value)).toEqual([20, 4, 20]);
    expect(v.points).toBe(2); // P/E 20 vs 30
    const dear = valuationView({ price: 500, f: f({ epsTTM: 10, marketCapCr: 50000 }), latest: { year: "FY26", equity: 5000, operatingCashFlow: 400 }, sectorPe: 25, financial: false });
    expect(dear.points).toBe(-3); // P/E 50 vs 25, and P/CFO 125 >> P/E
    const loss = valuationView({ price: 100, f: f({ epsTTM: -2, marketCapCr: 1000 }), sectorPe: 20, financial: false });
    expect(loss.metrics[0].value).toBeUndefined();
    expect(loss.points).toBe(-1);
  });

  it("growth: 3-year CAGR of revenue, cash flow and profit", () => {
    const years = [
      { year: "FY23", revenue: 1000, netIncome: 100, operatingCashFlow: 120 },
      { year: "FY24", revenue: 1150, netIncome: 115, operatingCashFlow: 130 },
      { year: "FY25", revenue: 1300, netIncome: 140, operatingCashFlow: 150 },
      { year: "FY26", revenue: 1521, netIncome: 175, operatingCashFlow: 180 },
    ];
    const g = growthView(years, false);
    expect(g.metrics.map((m) => m.value)).toEqual([15, 14.5, 20.5]);
    expect(g.points).toBe(3);
    expect(growthView([...years.slice(0, 3), { ...years[3], netIncome: -20 }], false).verdict).toBe("Loss-making");
    expect(growthView(years, true).metrics[1].value).toBeUndefined(); // lenders: no cash-flow growth
    expect(growthView(years.slice(0, 2), false).tone).toBe("n/a");
  });
});

describe("research desk in a run", () => {
  it("checks the candidates and reports in the desk thread", async () => {
    const msgs: Message[] = [];
    const res = await runAnalysis({ symbols: ALL_CAPS, top: 5, demo: true, aiNotes: false, riskPerTrade: 1, capital: 500000 }, (e) => { if (e.type === "message") msgs.push(e.message); });
    const withDesk = res.all.filter((d) => d.desk);
    expect(withDesk.length).toBeGreaterThanOrEqual(12);
    for (const d of withDesk) expect(Math.abs(d.desk!.points)).toBeLessThanOrEqual(8);
    const desk = msgs.filter((m) => m.thread === "desk");
    expect(desk.map((m) => m.sender)).toEqual(["Research", "Performance", "Valuation", "Growth", "Research"]);
    expect(desk[1].table?.columns).toContain("5Y a year");
    expect(desk[2].table?.columns).toContain("P/CFO");
    expect(desk[3].table?.columns).toContain("Cash flow");
  });
});
