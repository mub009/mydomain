import { describe, expect, it } from "vitest";
import { periodLabel, toPeriods } from "./company";

describe("financial statement periods", () => {
  it("labels Indian fiscal years and quarters", () => {
    expect(periodLabel("2026-03-31", "annual")).toBe("FY26");
    expect(periodLabel("2025-03-31", "annual")).toBe("FY25");
    expect(periodLabel("2025-06-30", "quarterly")).toBe("Q1 FY26");
    expect(periodLabel("2025-09-30", "quarterly")).toBe("Q2 FY26");
    expect(periodLabel("2025-12-31", "quarterly")).toBe("Q3 FY26");
    expect(periodLabel("2026-03-31", "quarterly")).toBe("Q4 FY26");
  });

  it("builds the income statement in ₹ crore, EPS in ₹, periods from the income lines", () => {
    const cr = 1e7;
    const s = {
      quarterlyTotalRevenue: [{ date: "2025-06-30", v: 1000 * cr }, { date: "2025-09-30", v: 1100 * cr }],
      quarterlyNetIncome: [{ date: "2025-06-30", v: 100 * cr }, { date: "2025-09-30", v: 120 * cr }],
      quarterlyDilutedEPS: [{ date: "2025-09-30", v: 12.345 }],
      quarterlyTaxProvision: [{ date: "2025-09-30", v: 30 * cr }],
      // half-yearly balance sheet: also has an older date that must not add a column
      quarterlyTotalAssets: [{ date: "2025-03-31", v: 5000 * cr }, { date: "2025-09-30", v: 5200 * cr }],
    };
    const q = toPeriods(s, "quarterly", 5);
    expect(q.map((p) => p.year)).toEqual(["Q1 FY26", "Q2 FY26"]);
    expect(q[1]).toMatchObject({ revenue: 1100, netIncome: 120, eps: 12.35, tax: 30, totalAssets: 5200 });
    expect(q[0].totalAssets).toBeUndefined();
  });

  it("keeps the most recent periods", () => {
    const s = { annualTotalRevenue: ["2021", "2022", "2023", "2024", "2025", "2026"].map((y) => ({ date: `${y}-03-31`, v: 1e9 })) };
    expect(toPeriods(s, "annual", 4).map((p) => p.year)).toEqual(["FY23", "FY24", "FY25", "FY26"]);
  });
});
