/**
 * NSE's official end-of-day data via the NSE Bhavcopy MCP server.
 * Daily bars are adjusted for splits and bonuses with NSE's own corporate-action
 * factors. NSE has no intraday or multi-year weekly bars here, so those come
 * from Yahoo.
 */
import { adjustForActions, nseBulkQuote, nseCorporateActions, nseIndexHistory, nseStockHistory } from "../nse-mcp/client";
import type { Bar } from "../types";
import { NSE_SECTOR_INDEX } from "./nse-sectors";

export { NSE_SECTOR_INDEX };
import type { MarketDataProvider } from "./provider";
import { yahooProvider } from "./yahoo";


const toBars = (rows: { date: string; open: number; high: number; low: number; close: number; volume: number }[]): Bar[] =>
  rows.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume }));

export async function nseDailyBars(symbol: string): Promise<Bar[]> {
  const raw = await nseStockHistory(symbol, 12);
  if (!raw.length) throw new Error("no NSE data");
  const actions = await nseCorporateActions(symbol, raw[0].date).catch(() => []);
  return toBars(adjustForActions(raw, actions));
}

export const nseProvider: MarketDataProvider = {
  id: "nse",
  label: "NSE Bhavcopy via NSE's MCP server (official, end of day)",
  realtime: false,
  getDailyBars: nseDailyBars,
  getIndexBars: async () => toBars(await nseIndexHistory("Nifty 50", 12)),
  getVixBars: async () => toBars(await nseIndexHistory("India VIX", 12)),
  getSectorIndexBars: async (sector) => (NSE_SECTOR_INDEX[sector] ? toBars(await nseIndexHistory(NSE_SECTOR_INDEX[sector], 12)) : []),
  getLongBars: (symbol) => yahooProvider.getLongBars(symbol),
  getIntradayBars: (symbol, interval) => yahooProvider.getIntradayBars(symbol, interval),
  getLastPrice: async (symbol) => {
    const q = (await nseBulkQuote([symbol]))[0];
    if (!q) throw new Error("no price");
    return q.close;
  },
};
