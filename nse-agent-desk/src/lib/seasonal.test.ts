import { describe, expect, it } from "vitest";
import { dividendEvents, monthStats, quarterStats, seasonalView } from "./seasonal";
import type { Bar } from "./types";

const bar = (date: string, close: number, open = close): Bar => ({ date, open, high: Math.max(open, close), low: Math.min(open, close), close, volume: 0 });

/** Month-end closes for `years` years where December always rises 5% and every other month is flat. */
function decemberRally(years: number): Bar[] {
  const out: Bar[] = [];
  let p = 100;
  for (let y = 2016; y < 2016 + years; y++) {
    for (let m = 1; m <= 12; m++) {
      if (m === 12) p *= 1.05;
      out.push(bar(`${y}-${String(m).padStart(2, "0")}-28`, p));
    }
  }
  out.push(bar(`${2016 + years}-01-15`, p)); // the current, unfinished month
  return out;
}

describe("seasonality", () => {
  it("averages each calendar month across years", () => {
    const { months, years } = monthStats(decemberRally(10));
    expect(years).toBe(10);
    expect(months[11]).toMatchObject({ month: 12, avg: 5, hit: 100 });
    expect(months[5]).toMatchObject({ avg: 0, hit: 0 });
  });

  it("finds the strong and weak fiscal quarters", () => {
    const qs = quarterStats([
      { date: "2025-06-30", revenue: 100 }, { date: "2025-09-30", revenue: 100 },
      { date: "2025-12-31", revenue: 140 }, { date: "2026-03-31", revenue: 60 },
    ]);
    expect(qs.find((q) => q.q === 3)?.revenueVsAvg).toBe(40);
    expect(qs.find((q) => q.q === 4)?.revenueVsAvg).toBe(-40);
    expect(qs.find((q) => q.q === 3)?.label).toBe("Q3 Oct-Dec");
  });

  it("measures the ex-dividend drop and the recovery", () => {
    const daily = [bar("2026-04-01", 100), bar("2026-04-02", 96, 95), bar("2026-04-03", 98), bar("2026-04-06", 100.5)];
    const [e] = dividendEvents(daily, [{ date: "2026-04-02", amount: 5 }]);
    expect(e).toMatchObject({ date: "2026-04-02", amount: 5, yieldPct: 5, exDayChangePct: -4, dropVsDividend: 1, recoveryDays: 2 });
  });

  it("scores a strong season, dividend yield and the next ex-date", () => {
    // Nov and Dec both rise every year; dividends every December
    const daily: Bar[] = [];
    let p = 100;
    for (let y = 2016; y <= 2026; y++) {
      for (let m = 1; m <= 12; m++) {
        if (y === 2026 && m > 11) break;
        if (m === 11 || m === 12) p *= 1.04;
        daily.push(bar(`${y}-${String(m).padStart(2, "0")}-${y === 2026 && m === 11 ? "19" : "27"}`, p));
      }
    }
    const dividends = Array.from({ length: 10 }, (_, i) => ({ date: `${2016 + i}-12-27`, amount: 6 }));
    const v = seasonalView({ daily, dividends, quarters: [], sample: true }, p);
    expect(v.seasonalDetail.window).toEqual([11, 12]);
    expect(v.points).toBe(3); // +2 season, +1 for a yield above 2% (₹6 on ~₹227)
    expect(v.verdict).toBe("Seasonal tailwind");
    expect(v.seasonalDetail.nextEx?.month).toBe("Dec 2026");
  });

  it("calls a weak season", () => {
    const daily: Bar[] = [];
    let p = 100;
    for (let y = 2016; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
      if (y === 2026 && m > 11) break;
      if (m === 11 || m === 12) p *= 0.96;
      daily.push(bar(`${y}-${String(m).padStart(2, "0")}-${y === 2026 && m === 11 ? "19" : "27"}`, p));
    }
    const v = seasonalView({ daily, dividends: [], quarters: [], sample: true }, p);
    expect(v.points).toBe(-2);
    expect(v.verdict).toBe("Seasonal headwind");
  });
});
