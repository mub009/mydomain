/** Plain helpers for stock lists: current price with a fallback, and the buy-zone filter. */
import type { Quote } from "./market/quotes";
import type { BuyZone, Decision } from "./types";

/** Last close from the run's 60-day closes, and its change from the day before. */
export function lastClose(d: Pick<Decision, "spark" | "entry">): { price: number; changePct?: number } {
  const s = d.spark;
  if (s.length >= 2) return { price: s[s.length - 1], changePct: (s[s.length - 1] / s[s.length - 2] - 1) * 100 };
  return { price: s[s.length - 1] ?? d.entry };
}

/** The stock's current price (live quote when we have one, otherwise the run's last close) and today's change. */
export function currentPrice(d: Pick<Decision, "spark" | "entry" | "symbol">, q?: Quote) {
  return q ? { price: q.price, changePct: q.changePct, live: true } : { ...lastClose(d), live: false };
}

/** Buy-zone filter: where today's price sits against the best buy area. */
export type ZoneFilter = "ALL" | BuyZone["plan"];
export const ZONE_FILTERS: { value: ZoneFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "In buy zone", label: "Buy zone" },
  { value: "Wait for dip", label: "Buy on dip" },
  { value: "Extended", label: "Extended" },
];
export const matchesZone = (d: Pick<Decision, "chart">, z: ZoneFilter) => z === "ALL" || d.chart?.zone?.plan === z;

export const TOP_N = [0, 3, 5, 10, 15, 20, 25] as const;


/** Trade type: short swing (1-10 days), positional (~1 month) or long swing (from a bottom, up to ~3 months). */
export type TradeFilter = "ALL" | "Short swing" | "Positional" | "Long swing";
export const TRADE_FILTERS: { value: TradeFilter; label: string; hint: string }[] = [
  { value: "ALL", label: "All", hint: "Every trade type" },
  { value: "Short swing", label: "Short swing", hint: "1-10 days, momentum" },
  { value: "Positional", label: "Positional", hint: "About 1 month, trend" },
  { value: "Long swing", label: "Long swing", hint: "3 weeks to 3 months, turning up from a bottom" },
];
export function matchesTrade(d: Pick<Decision, "horizon" | "bottom">, f: TradeFilter): boolean {
  if (f === "ALL") return true;
  if (f === "Long swing") return d.horizon.startsWith("Long swing") || Boolean(d.bottom?.isSetup);
  if (f === "Short swing") return d.horizon.startsWith("Swing");
  return d.horizon.startsWith("Positional") || d.horizon.startsWith("Swing, then");
}
