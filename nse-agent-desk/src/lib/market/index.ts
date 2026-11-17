import type { Bar, DataSource } from "../types";
import { demoBars, demoIndex, demoVix } from "./demo";
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
