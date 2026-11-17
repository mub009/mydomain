import { describe, expect, it } from "vitest";
import { analyseChart, findBuyZone, historyWindows, readTimeframe, to4h, toHourly, toMonthly } from "./chart";
import { demoBars, demoIntraday } from "./market/demo";
import { NIFTY50 } from "./market/universe";
import { runAnalysis } from "./pipeline";
import type { Bar, Message } from "./types";

const daily = demoBars("RELIANCE", 21);
const m30 = demoIntraday(daily, "RELIANCE", 21, 60);

describe("candles", () => {
  it("builds 13 half-hour bars per day, 7 hourly, 2 four-hour", () => {
    expect(m30).toHaveLength(60 * 13);
    const h1 = toHourly(m30);
    expect(h1).toHaveLength(60 * 7);
    expect(to4h(h1)).toHaveLength(60 * 2);
  });
  it("aggregated candles keep open, close, high, low and volume right", () => {
    const day = m30.slice(0, 13);
    const [first] = to4h(toHourly(day));
    expect(first.open).toBe(day[0].open);
    expect(first.close).toBe(day[7].close); // first 4 hours = first 8 half-hour bars
    expect(first.high).toBe(Math.max(...day.slice(0, 8).map((b) => b.high)));
    expect(first.volume).toBeCloseTo(day.slice(0, 8).reduce((s, b) => s + b.volume, 0));
  });
  it("intraday stays inside each day's range and ends at the close", () => {
    const d = daily[daily.length - 1];
    const today = m30.slice(-13);
    expect(today[12].close).toBeCloseTo(d.close);
    for (const b of today) { expect(b.high).toBeLessThanOrEqual(d.high + 1e-9); expect(b.low).toBeGreaterThanOrEqual(d.low - 1e-9); }
  });
  it("monthly candles group by calendar month", () => {
    const mo = toMonthly(daily);
    expect(mo.length).toBeGreaterThanOrEqual(12);
    expect(new Set(mo.map((b) => b.date.slice(0, 7))).size).toBe(mo.length);
  });
});

describe("trend reading", () => {
  const ramp = (n: number, step: number): Bar[] =>
    Array.from({ length: n }, (_, i) => { const c = 100 + i * step; return { date: `d${i}`, open: c, high: c + 1, low: c - 1, close: c, volume: 1 }; });
  it("rising prices read bullish, falling bearish", () => {
    expect(readTimeframe("1D", ramp(80, 1)).trend).toBe("Bullish");
    expect(readTimeframe("1D", ramp(80, -0.5)).trend).toBe("Bearish");
  });
  it("too few bars reads neutral", () => expect(readTimeframe("1H", ramp(10, 1)).trend).toBe("Neutral"));
});

describe("best buy area", () => {
  it("is below the price and backed by history", () => {
    const w = historyWindows(daily);
    expect(w.map((x) => x.label)).toEqual(["1M", "3M", "6M", "1Y"]);
    const z = findBuyZone(daily, w);
    if (z) {
      const price = daily[daily.length - 1].close;
      expect(z.low).toBeLessThan(z.high);
      expect(z.high).toBeLessThanOrEqual(price + 1e-9);
      expect(z.stop).toBeLessThan(z.low);
      expect(z.basis.length).toBeGreaterThan(0);
      expect(["In buy zone", "Wait for dip", "Extended"]).toContain(z.plan);
    }
  });
  it("finds a zone at a level the market keeps returning to", () => {
    // Price bounces off ~100 several times, then trades at 110.
    const bars: Bar[] = [];
    for (let i = 0; i < 260; i++) {
      const c = 105 + 5 * Math.sin(i / 6) + (i > 250 ? 3 : 0);
      bars.push({ date: `2026-${String(1 + Math.floor(i / 22)).padStart(2, "0")}-${String(1 + (i % 22)).padStart(2, "0")}`, open: c, high: c + 0.8, low: c - 0.8, close: c, volume: 1000 });
    }
    const z = findBuyZone(bars, historyWindows(bars))!;
    expect(z).not.toBeNull();
    expect(z.low).toBeLessThan(103);
  });
  it("says the 4H/1H/30m reading is missing when there is no intraday data", () => {
    const c = analyseChart(daily, null, null);
    expect(c.intraday).toBe(false);
    expect(c.timeframes.slice(2).every((t) => t.bars === 0)).toBe(true);
  });
});

describe("in the full run", () => {
  it("top candidates carry a chart check and Mubashir reports it", async () => {
    const msgs: Message[] = [];
    const r = await runAnalysis({ symbols: NIFTY50, top: 5, demo: true, aiNotes: false, riskPerTrade: 1 }, (e) => { if (e.type === "message") msgs.push(e.message); });
    for (const p of r.picks) {
      expect(p.chart).toBeDefined();
      expect(p.chart!.timeframes.map((t) => t.tf)).toEqual(["1M", "1D", "4H", "1H", "30m"]);
      expect(p.chart!.intraday).toBe(true);
    }
    const report = msgs.find((m) => m.table?.columns.includes("Buy zone"));
    expect(report?.sender).toBe("Mubashir");
    expect(report?.table?.columns).toEqual(["Symbol", "1M", "1D", "4H", "1H", "30m", "Buy zone", "Plan"]);
    for (const m of msgs) expect(m.text).not.toMatch(/undefined|NaN|Infinity/);
  });
});
