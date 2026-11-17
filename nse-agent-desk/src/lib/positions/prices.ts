/** Current price for a tracked position. */
import { getProvider } from "../market";
import type { Position } from "./types";

function seeded(str: string) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(rand() || 1e-12)) * Math.cos(2 * Math.PI * rand());
}

/**
 * Demo price feed: a random walk from the buy price that takes one step per
 * real minute, so a demo position moves visibly while you watch. Each
 * position gets its own drift, so some reach the target and some the stop.
 * Fictional; only for positions tracked from a demo run.
 */
export function demoPrice(p: Position, at = new Date()): number {
  const minutes = Math.min(720, Math.max(0, Math.floor((at.getTime() - new Date(p.openedAt).getTime()) / 60000)));
  const n = seeded(`pos:${p.id}`);
  const drift = n() * 0.0012;
  let logp = 0;
  for (let k = 0; k < minutes; k++) logp += drift + n() * 0.003;
  return Math.round(p.buyPrice * Math.exp(logp) * 100) / 100;
}

/** Last traded price: demo walk, or the market-data provider (Yahoo 5-minute bars are delayed). */
export async function currentPrice(p: Position): Promise<number> {
  if (p.feed === "demo") return demoPrice(p);
  const provider = getProvider();
  if (!provider) throw new Error("No market-data provider configured");
  return provider.getLastPrice(p.symbol);
}
