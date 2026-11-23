import { afterEach, describe, expect, it, vi } from "vitest";
import { loadStockList, parseEquityCsv, parseIndexCsv, sectorFromIndustry } from "./market/lists";
import { isThin, quickRow, quickScan, rankQuick } from "./market/prescreen";
import { ALL_CAPS } from "./market/universe";
import { scanLine } from "./dialogue";

const INDEX_CSV = `Company Name,Industry,Symbol,Series,ISIN Code
HDFC Bank Ltd.,Financial Services,HDFCBANK,EQ,INE040A01034
Bajaj Finance Ltd.,Financial Services,BAJFINANCE,EQ,INE296A01032
"Mahindra & Mahindra Ltd.",Automobile and Auto Components,M&M,EQ,INE101A01026
Infosys Ltd.,Information Technology,INFY,EQ,INE009A01021
Odd Co,Some New Industry 2,ODDCO,EQ,INE000000000
Bad,Power,not a symbol!,EQ,X
`;

const EQUITY_CSV = `SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
RELIANCE,Reliance Industries Limited,EQ,29-NOV-1995,10,1,INE002A01018,10
SOMEBE,Some BE Co,BE,01-JAN-2020,10,1,INE000000001,10
TCS,Tata Consultancy Services Limited,EQ,25-AUG-2004,1,1,INE467B01029,1
TCS,Tata Consultancy Services Limited,EQ,25-AUG-2004,1,1,INE467B01029,1
`;

describe("NSE stock lists", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps NSE industries to desk sectors and splits banks out", () => {
    expect(sectorFromIndustry("Financial Services", "HDFC Bank Ltd.")).toBe("Banks");
    expect(sectorFromIndustry("Financial Services", "Bajaj Finance Ltd.")).toBe("Financials");
    expect(sectorFromIndustry("Information Technology")).toBe("IT");
    expect(sectorFromIndustry("Oil Gas & Consumable Fuels")).toBe("Energy");
    expect(sectorFromIndustry("Construction")).toBe("Infrastructure");
    expect(sectorFromIndustry("Construction Materials")).toBe("Cement");
    expect(sectorFromIndustry("")).toBe("Other");
  });

  it("reads an index list with quoted names and skips bad symbols", () => {
    const { symbols, sectors } = parseIndexCsv(INDEX_CSV);
    expect(symbols).toEqual(["HDFCBANK", "BAJFINANCE", "M&M", "INFY", "ODDCO"]);
    expect(sectors["M&M"]).toBe("Auto");
    expect(sectors.ODDCO).toBe("Some New Industry");
  });

  it("reads NSE's full list: EQ series only, no repeats", () => {
    expect(parseEquityCsv(EQUITY_CSV)).toEqual(["RELIANCE", "TCS"]);
  });

  it("falls back to the built-in stocks when NSE can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("blocked", { status: 403 })));
    const list = await loadStockList("nifty500");
    expect(list.from).toBe("built-in");
    expect(list.symbols).toEqual(ALL_CAPS);
    expect(list.note).toMatch(/couldn't be downloaded/);
  });
});

const rising = (n: number, from = 100, step = 0.5) => Array.from({ length: n }, (_, i) => from + i * step);

describe("quick scan", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("scores trend and momentum from closing prices", () => {
    const r = quickRow("UP", { close: rising(250), volume: 1e6 })!;
    expect(r.ret21).toBeGreaterThan(0);
    expect(r.above50 && r.above200).toBe(true);
    expect(r.offHigh).toBeCloseTo(0);
    expect(r.tradedCr).toBeGreaterThan(1);
    expect(quickRow("NEW", { close: rising(30) })).toBeNull();
  });

  it("leaves out very cheap or barely traded shares", () => {
    expect(isThin(quickRow("PENNY", { close: rising(100, 5, 0.01), volume: 1e8 })!)).toBe(true);
    expect(isThin(quickRow("QUIET", { close: rising(100), volume: 100 })!)).toBe(true);
  });

  it("ranks the strongest first", () => {
    const up = quickRow("UP", { close: rising(250), volume: 1e6 })!;
    const down = quickRow("DOWN", { close: rising(250, 300, -0.5), volume: 1e6 })!;
    const ranked = rankQuick([down, up]);
    expect(ranked.map((r) => r.symbol)).toEqual(["UP", "DOWN"]);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("asks for 20 stocks per request and keeps the best", async () => {
    const symbols = Array.from({ length: 45 }, (_, i) => `S${i}`);
    const calls: number[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const syms = decodeURIComponent(new URL(url).searchParams.get("symbols")!).split(",");
      calls.push(syms.length);
      return Response.json({ spark: { result: syms.map((s) => {
        const k = Number(s.slice(1, -3));
        return { symbol: s, response: [{ meta: { regularMarketVolume: 1e6 }, indicators: { quote: [{ close: rising(250, 100, k / 10) }] } }] };
      }) } });
    }));
    const q = await quickScan(symbols, 10);
    expect(calls.sort((a, b) => b - a)).toEqual([20, 20, 5]);
    expect(q.priced).toBe(45);
    expect(q.shortlist).toHaveLength(10);
    expect(q.shortlist[0].symbol).toBe("S44");
  });

  it("explains the narrowing in one line", () => {
    const line = scanLine({ label: "All NSE stocks", total: 2134, priced: 2050, thin: 600, shortlisted: 150, from: "nse" });
    expect(line).toContain("Quick scan of the All NSE stocks list: 2,134 stocks");
    expect(line).toContain("1,450 had a year of prices");
    expect(line).toContain("150 strongest");
  });
});
