import { describe, expect, it } from "vitest";
import { ALL_CAPS } from "./market/universe";
import { runAnalysis } from "./pipeline";
import { cagr, defaultProbability, entryView, expectedReturn, fiveYearCagr, growthView, performanceView, profitabilityView, pumpPattern, redFlagView, valuationView, ytdReturn } from "./research-desk";
import { collectStages, type Surveillance } from "./surveillance";
import type { Analysis } from "./types";
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

const surv = (o: Partial<Surveillance> = {}): Surveillance => ({
  asm: {}, gsm: {}, unsolicited: [], pledge: {}, checked: { asm: true, gsm: true, unsolicited: true, pledge: true }, source: "t", sample: true, ...o,
});

describe("profitability, red flags and entry", () => {
  const years = [
    { year: "FY24", revenue: 1000, netIncome: 150, equity: 700, operatingCashFlow: 170 },
    { year: "FY25", revenue: 1100, netIncome: 170, equity: 800, operatingCashFlow: 180 },
    { year: "FY26", revenue: 1200, netIncome: 200, equity: 900, operatingCashFlow: 220 },
  ];

  it("profitability: ROE, net margin and cash conversion", () => {
    const v = profitabilityView(years, false);
    expect(v.metrics.map((m) => m.value)).toEqual([22.2, 16.7, 1.1]);
    expect(v.points).toBe(3);
    const poor = profitabilityView(years.map((y) => ({ ...y, operatingCashFlow: y.netIncome * 0.4, equity: y.equity * 4 })), false); // ROE ~5.6%, 40% cash conversion
    expect(poor.points).toBe(-2);
    expect(profitabilityView([...years.slice(0, 2), { ...years[2], netIncome: -10 }], false).verdict).toBe("Weak profits");
  });

  it("default probability rises with debt and volatility", () => {
    expect(defaultProbability({ marketCapCr: 10000, debtCr: 0, equityVol: 0.3, ret1y: 0.1 })).toBe(0);
    const low = defaultProbability({ marketCapCr: 10000, debtCr: 1000, equityVol: 0.25, ret1y: 0.1 });
    const high = defaultProbability({ marketCapCr: 1000, debtCr: 4000, equityVol: 0.8, ret1y: -0.4 });
    expect(low).toBeLessThan(0.01);
    expect(high).toBeGreaterThan(5);
  });

  it("pump pattern: a sharp run-up on heavy volume in a smaller stock", () => {
    const bars = Array.from({ length: 40 }, (_, i) => ({ date: `d${i}`, open: 100, high: 100, low: 100, close: i < 30 ? 100 : 100 + (i - 29) * 4, volume: i < 30 ? 1000 : 5000 }));
    expect(pumpPattern(bars, "Small")).toMatch(/in 10 days/);
    expect(pumpPattern(bars, "Large")).toBeNull();
  });

  it("red flags: GSM, late-stage ASM, pledge, tips and default risk", () => {
    const clean = redFlagView({ symbol: "ABC", surv: surv(), pledgePct: 0, pd: 0.1, financial: false, pump: null });
    expect(clean.verdict).toBe("Clear");
    expect(clean.points).toBe(0);
    const bad = redFlagView({ symbol: "ABC", surv: surv({ gsm: { ABC: "Stage I" }, asm: { ABC: "LT Stage II" } }), pledgePct: 60, pd: 8, financial: false, pump: null });
    expect(bad.flags!.filter((f) => f.status === "severe").map((f) => f.check)).toEqual(["GSM", "ASM", "Promoter pledge", "Default risk"]);
    expect(bad.points).toBe(-10);
    const st = redFlagView({ symbol: "ABC", surv: surv({ asm: { ABC: "ST Stage I" } }), pledgePct: 15, financial: false, pump: "x", pd: 0 });
    expect(st.flags!.filter((f) => f.status === "warning").map((f) => f.check)).toEqual(["ASM", "Promoter pledge", "Unsolicited tips"]);
    const unchecked = redFlagView({ symbol: "ABC", surv: surv({ checked: { asm: false, gsm: false, unsolicited: false, pledge: false } }), financial: true, pump: null });
    expect(unchecked.flags!.filter((f) => f.status === "unknown").length).toBe(4);
  });

  it("reads NSE-style ASM JSON", () => {
    const rows = collectStages({ longterm: { data: [{ symbol: "abc", asmSurvIndicator: "Stage II" }] }, shortterm: { data: [{ symbol: "XYZ", asmSurvIndicator: "Stage I" }] } });
    expect(rows).toEqual([{ symbol: "ABC", stage: "Stage II", trail: "/longterm/data" }, { symbol: "XYZ", stage: "Stage I", trail: "/shortterm/data" }]);
  });

  it("entry: fundamentals plus technicals", () => {
    const view = (points: number) => ({ agent: "Valuation" as const, points, tone: "ok" as const, verdict: "", metrics: [], reasons: [] });
    const desk = { performance: view(0), valuation: view(1), growth: view(2), profitability: view(1), redFlags: view(0), points: 4, severe: false, sample: true, source: "t" };
    const zone = { low: 95, high: 100, stop: 90, distancePct: 0, plan: "In buy zone" as const, basis: [], confirmations: 3 };
    const row = { rsi: 60, desk, chart: { bullish: 4, bearish: 0, zone } } as unknown as Analysis;
    expect(entryView(row)!.verdict).toBe("Buy now");
    expect(entryView({ ...row, chart: { ...row.chart!, zone: { ...zone, plan: "Wait for dip", distancePct: 4 } } } as Analysis)!.verdict).toBe("Buy on dip");
    expect(entryView({ ...row, desk: { ...desk, severe: true } } as Analysis)!.verdict).toBe("Avoid");
  });
});

describe("research desk in a run", () => {
  it("checks the candidates and reports in the desk thread", async () => {
    const msgs: Message[] = [];
    const res = await runAnalysis({ symbols: ALL_CAPS, top: 5, demo: true, aiNotes: false, riskPerTrade: 1, capital: 500000 }, (e) => { if (e.type === "message") msgs.push(e.message); });
    const withDesk = res.all.filter((d) => d.desk);
    expect(withDesk.length).toBeGreaterThanOrEqual(12);
    for (const d of withDesk) {
      expect(d.desk!.points).toBeLessThanOrEqual(12);
      expect(d.desk!.points).toBeGreaterThanOrEqual(-22);
      if (d.desk!.severe) expect(["WATCH", "AVOID"]).toContain(d.verdict);
    }
    const desk = msgs.filter((m) => m.thread === "desk");
    expect(desk.map((m) => m.sender)).toEqual(["Research", "Performance", "Valuation", "Growth", "Profitability", "Seasonal", "RedFlag", "Entry", "Research"]);
    expect(desk[1].table?.columns).toContain("5Y a year");
    expect(desk[2].table?.columns).toContain("P/CFO");
    expect(desk[3].table?.columns).toContain("Cash flow");
  });
});
