import { describe, expect, it } from "vitest";
import { readSpark, tradingViewUrl } from "./market/quotes";
import { lastClose, matchesZone, currentPrice } from "./stock-view";

describe("current prices", () => {
  it("reads Yahoo's batch reply", () => {
    const q = readSpark({ spark: { result: [
      { symbol: "M&M.NS", response: [{ meta: { regularMarketPrice: 3487.4, regularMarketChangePercent: -1.625, chartPreviousClose: 3545, regularMarketTime: 1795427975, longName: "Mahindra & Mahindra Limited" } }] },
      { symbol: "TCS.NS", response: [{ meta: { regularMarketPrice: 3100, chartPreviousClose: 3000, regularMarketTime: 1795427975 } }] },
      { symbol: "BAD.NS", response: [{ meta: {} }] },
    ] } });
    expect(q.map((x) => x.symbol)).toEqual(["M&M", "TCS"]);
    expect(q[0]).toMatchObject({ price: 3487.4, name: "Mahindra & Mahindra Limited" });
    expect(q[0].changePct).toBeCloseTo(-1.62, 1);
    expect(q[1].changePct).toBeCloseTo(3.33, 2);
  });

  it("falls back to the run's last close", () => {
    const d = { symbol: "X", entry: 99, spark: [100, 102] };
    expect(lastClose(d).price).toBe(102);
    expect(lastClose(d).changePct).toBeCloseTo(2);
    expect(currentPrice(d).live).toBe(false);
    expect(currentPrice(d, { symbol: "X", price: 105, changePct: 1, at: "" }).price).toBe(105);
  });
});

describe("TradingView link", () => {
  it("uses TradingView's NSE symbols", () => {
    expect(tradingViewUrl("RELIANCE")).toBe("https://www.tradingview.com/chart/?symbol=NSE%3ARELIANCE");
    expect(tradingViewUrl("M&M")).toContain("NSE%3AM_M");
    expect(tradingViewUrl("BAJAJ-AUTO")).toContain("NSE%3ABAJAJ_AUTO");
  });
});

describe("buy-zone filter", () => {
  const zone = (plan: "In buy zone" | "Wait for dip" | "Extended") => ({ chart: { zone: { plan } } }) as never;
  it("matches the zone, and everything for All", () => {
    expect(matchesZone(zone("Extended"), "Extended")).toBe(true);
    expect(matchesZone(zone("Extended"), "In buy zone")).toBe(false);
    expect(matchesZone({ chart: undefined }, "Wait for dip")).toBe(false);
    expect(matchesZone({ chart: undefined }, "ALL")).toBe(true);
  });
});
