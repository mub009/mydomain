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

