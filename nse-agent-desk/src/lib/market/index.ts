import { toHourly } from "../chart";
import type { Bar, DataSource } from "../types";
import { demoBars, demoIndex, demoIntraday, demoVix } from "./demo";
import type { MarketDataProvider } from "./provider";
import { yahooProvider } from "./yahoo";

const PROVIDERS: Record<string, MarketDataProvider> = { yahoo: yahooProvider };

/** The provider used when "Demo data" is off. Chosen with MARKET_DATA_PROVIDER. */
export function getProvider(): MarketDataProvider | null {
  const id = (process.env.MARKET_DATA_PROVIDER ?? "yahoo").toLowerCase();
  return PROVIDERS[id] ?? null;
}

export interface Loaded {
  frames: Record<string, Bar[]>;
  indexClose: number[];
  /** India VIX closes; empty when unavailable. */
  vixClose: number[];
  source: DataSource;
  skipped: string[];
}

function loadDemo(symbols: string[], fallbackReason?: string): Loaded {
  const seed = Math.floor(Math.random() * 1_000_000);
  const frames = Object.fromEntries(symbols.map((s) => [s, demoBars(s, seed)]));
  const indexClose = demoIndex(Object.values(frames));
  return {
    frames, indexClose, vixClose: demoVix(indexClose, seed), skipped: [],
    source: { kind: "demo", label: "Demo data (fictional prices)", seed, fallbackReason },
  };
}

/**
 * Intraday candles for the stocks Mubashir checks closely.
 * Returns 30-minute bars (~60 days) and hourly bars (~6 months) per symbol;
 * a symbol is missing when its intraday data could not be loaded.
 */
export async function loadIntraday(symbols: string[], source: DataSource, frames: Record<string, Bar[]>) {
  const out: Record<string, { m30: Bar[]; h1: Bar[] | null }> = {};
  if (source.kind === "demo") {
    for (const s of symbols) {
      const m30 = demoIntraday(frames[s], s, source.seed ?? 0, 120);
      // 30-minute bars for the last 60 days; hourly bars from all 120 days
      out[s] = { m30: m30.slice(-60 * 13), h1: toHourly(m30) };
    }
    return out;
  }
  const provider = getProvider();
  if (!provider) return out;
  await Promise.all(symbols.map(async (s) => {
    try {
      const [m30, h1] = await Promise.all([provider.getIntradayBars(s, "30m"), provider.getIntradayBars(s, "60m").catch(() => null)]);
      if (m30.length) out[s] = { m30, h1: h1?.length ? h1 : null };
    } catch { /* this symbol is checked on daily data only */ }
  }));
  return out;
}

export async function loadMarket(
  symbols: string[], demo: boolean, onProgress?: (done: number, total: number) => void,
): Promise<Loaded> {
  if (demo) return loadDemo(symbols);
  const provider = getProvider();
  if (!provider) return loadDemo(symbols, "No market-data provider is configured.");

  const frames: Record<string, Bar[]> = {};
  const skipped: string[] = [];
  let done = 0;
  const queue = [...symbols];
  const worker = async () => {
    for (let sym = queue.shift(); sym; sym = queue.shift()) {
      try {
        const bars = await provider.getDailyBars(sym);
        if (bars.length >= 60) frames[sym] = bars; else skipped.push(`${sym} (not enough history)`);
      } catch (e) {
        skipped.push(`${sym} (${(e as Error).message})`);
      }
      onProgress?.(++done, symbols.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (!Object.keys(frames).length) return loadDemo(symbols, `${provider.label} could not be reached.`);

  let indexClose: number[] = [];
  try { indexClose = (await provider.getIndexBars()).map((b) => b.close); } catch { /* index is optional */ }
  let vixClose: number[] = [];
  try { vixClose = (await provider.getVixBars()).map((b) => b.close); } catch { /* VIX is optional */ }
  return { frames, indexClose, vixClose, skipped, source: { kind: "eod", label: provider.label } };
}
