import type { Bar } from "../types";

/**
 * Market-data provider interface. Everything above this layer (agents,
 * pipeline, UI) is provider-agnostic.
 *
 * To connect a licensed NSE feed (or a broker API), implement this interface
 * in a new file and register it in ./index.ts. Set `realtime: true` only for
 * a source that is actually licensed to deliver real-time NSE prices; the UI
 * uses this flag and `label` to tell the user what they are looking at.
 */
export interface MarketDataProvider {
  id: string;
  /** Shown in the UI, e.g. "Yahoo Finance (unofficial, end-of-day)". */
  label: string;
  realtime: boolean;
  /** About one year of daily bars, oldest first, adjusted for splits/dividends. */
  getDailyBars(symbol: string): Promise<Bar[]>;
  /** Daily bars for the Nifty 50 index. */
  getIndexBars(): Promise<Bar[]>;
  /** Daily bars for India VIX (the NSE volatility index). */
  getVixBars(): Promise<Bar[]>;
  /** Intraday bars: "30m" for ~60 days, "60m" for ~6 months. Times are ISO (UTC). */
  getIntradayBars(symbol: string, interval: "30m" | "60m"): Promise<Bar[]>;
  /** About five years of weekly bars, oldest first, for long-term returns. */
  getLongBars(symbol: string): Promise<Bar[]>;
  /** A sector's NSE index (when the provider has sector indices by sector name). */
  getSectorIndexBars?(sector: string): Promise<Bar[]>;
  /** Latest traded price (may be delayed). */
  getLastPrice(symbol: string): Promise<number>;
}
