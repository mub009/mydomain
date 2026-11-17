import { afterEach, describe, expect, it, vi } from "vitest";
import { companyReport, demoFinancials, demoShareholding } from "./company";
import { computeRatios, gradeQuality } from "./company/quality";
import type { YearFinancials } from "./company/types";
import { demoFundamentals } from "./fundamentals";

afterEach(() => { vi.unstubAllGlobals(); });

const yr = (y: string, p: Partial<YearFinancials>): YearFinancials => ({ year: y, ...p });
const strong = ["FY22", "FY23", "FY24", "FY25"].map((y, i) => yr(y, {
  netIncome: 100 + i * 10, operatingCashFlow: 120 + i * 10, capex: 40, freeCashFlow: 80 + i * 10,
  equity: 500, debt: 100, currentAssets: 300, currentLiabilities: 200, ebit: 160, interestExpense: 10,
}));

describe("quality grading", () => {
  it("computes the ratios", () => {
    const r = computeRatios(strong);
    expect(r.roe).toBe(26); // 130 / 500
    expect(r.debtToEquity).toBe(0.2);
    expect(r.currentRatio).toBe(1.5);
    expect(r.cashConversion).toBeCloseTo((130 + 140 + 150) / (110 + 120 + 130), 2);
    expect(r.interestCover).toBe(16);
    expect(r.fcfPositiveYears).toBe(4);
  });

  it("a cash-rich, low-debt company grades A", () => {
    expect(gradeQuality(strong, "IT").quality.grade).toBe("A");
  });

  it("profits without cash and heavy debt grade D", () => {
    const weak = strong.map((y) => ({ ...y, operatingCashFlow: 30, freeCashFlow: -20, debt: 1000, currentLiabilities: 400, ebit: 120, interestExpense: 80, netIncome: 60 })); // cash conversion 0.5
    const g = gradeQuality(weak, "Auto");
    expect(g.quality.grade).toBe("D");
    expect(g.quality.checks.find((c) => c.label === "Cash conversion")!.verdict).toBe("weak");
  });

  it("banks are graded only on ROE and profit growth", () => {
    const g = gradeQuality(strong.map((y) => ({ ...y, debt: 5000 })), "Banks");
    expect(g.quality.financialSector).toBe(true);
    expect(g.quality.checks.map((c) => c.label)).toEqual(["Return on equity", "Profit growth (1Y)"]);
  });

  it("a loss-making company grades C at best", () => {
    const loss = strong.map((y, i) => (i === 3 ? { ...y, netIncome: -20 } : y));
    const g = gradeQuality(loss, "IT");
    expect(g.quality.grade).toBe("C");
    expect(g.quality.summary).toMatch(/Loss-making/);
  });

  it("says n/a when there's no data", () => expect(gradeQuality([], "IT").quality.grade).toBe("n/a"));
});

describe("demo figures", () => {
  it("net profit matches the demo EPS × shares", () => {
    const f = demoFundamentals("TCS", 3500, 9);
    const y = demoFinancials("TCS", 3500, 9);
    const shares = (f.marketCapCr! * 1e7) / 3500;
    expect(y.at(-1)!.netIncome).toBeCloseTo((f.epsTTM! * shares) / 1e7, -1);
    expect(y.map((x) => x.year)).toEqual(f.epsHistory.map((h) => h.period));
  });
  it("shareholding adds up to about 100% and is labelled sample", () => {
    const s = demoShareholding("TCS", 9);
    expect(s.categories.reduce((a, c) => a + c.pct, 0)).toBeCloseTo(100, 0);
    expect(s.sample).toBe(true);
  });
});

describe("live parsing (simulated Yahoo responses)", () => {
  it("reads annual statements and the holders breakdown", async () => {
    const ts = (t: string, vals: number[]) => ({ meta: { type: [t] }, [t]: vals.map((v, i) => ({ asOfDate: `202${2 + i}-03-31`, reportedValue: { raw: v * 1e7 } })) });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("fundamentals-timeseries")) return new Response(JSON.stringify({ timeseries: { result: [
        ts("annualNetIncome", [100, 110, 120, 130]), ts("annualOperatingCashFlow", [120, 130, 140, 150]),
        ts("annualCapitalExpenditure", [-40, -40, -40, -40]), ts("annualStockholdersEquity", [500, 500, 500, 500]),
        ts("annualTotalDebt", [100, 100, 100, 100]),
      ] } }));
      if (url.includes("fc.yahoo.com")) return new Response("", { headers: { "set-cookie": "A3=abc; Path=/" } });
      if (url.includes("getcrumb")) return new Response("CRUMB");
      if (url.includes("quoteSummary")) return new Response(JSON.stringify({ quoteSummary: { result: [{
        majorHoldersBreakdown: { insidersPercentHeld: { raw: 0.72 }, institutionsPercentHeld: { raw: 0.18 } },
        institutionOwnership: { ownershipList: [{ organization: "Fund House X", pctHeld: { raw: 0.031 }, reportDate: { fmt: "2026-09-30" } }] },
      }] } }));
      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await companyReport("LIVETEST", { demo: false, price: 100, seed: 0 });
    expect(r.years.map((y) => y.year)).toEqual(["FY22", "FY23", "FY24", "FY25"]);
    expect(r.years.at(-1)!.capex).toBe(40); // spending shown as a positive number
    expect(r.ratios.roe).toBe(26);
    expect(r.shareholding!.categories).toEqual([
      { label: "Insiders (mostly promoters)", pct: 72 }, { label: "Institutions (FIIs + DIIs)", pct: 18 }, { label: "Public & others", pct: 10 },
    ]);
    expect(r.shareholding!.top[0]).toEqual({ name: "Fund House X", type: "Institution", pct: 3.1 });
    const qs = fetchMock.mock.calls.find((c) => String(c[0]).includes("quoteSummary"))!;
    expect(String(qs[0])).toContain("crumb=CRUMB");
  });

  it("still returns a report when Yahoo is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("blocked"); }));
    const r = await companyReport("OFFLINE", { demo: false, price: 100, seed: 0 });
    expect(r.years).toEqual([]);
    expect(r.shareholding).toBeNull();
    expect(r.quality.grade).toBe("n/a");
    expect(r.links[0].url).toContain("nseindia.com");
  });
});
