/** Words for the Decision Agent's holding plan, used in chat and on screen. */
import type { HoldPlan } from "./forecast";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-12-02" → "2 Dec" */
export const shortDate = (iso?: string) => (iso ? `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}` : "");
const signedPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

/** "~6 days" or "up to 10 days" when the target is rarely reached in time. */
export function holdShort(h?: HoldPlan): string {
  if (!h) return "-";
  return h.expectedDays ? `~${h.expectedDays} day${h.expectedDays > 1 ? "s" : ""}` : `up to ${h.maxDays} days`;
}

/** One sentence: how long, by when, odds and the expected return. */
export function holdSentence(h: HoldPlan): string {
  const when = h.expectedDays
    ? `Expected to reach the target in about ${h.expectedDays} trading day${h.expectedDays > 1 ? "s" : ""} (around ${shortDate(h.expectedBy)}${h.daysRange && h.daysRange[0] !== h.daysRange[1] ? `; ${h.daysRange[0]}-${h.daysRange[1]} days in most cases` : ""})`
    : `The target is rarely reached within ${h.maxDays} trading days`;
  return `${when}. Hold at most ${h.maxDays} trading days, until ${shortDate(h.exitBy)}; exit then if neither the target (${signedPct(h.targetPct)}) nor the stop-loss (${signedPct(h.stopPct)}) is hit. ` +
    `Odds: ${h.probTarget}% target first, ${h.probStop}% stop-loss first, ${h.probOpen}% neither. Expected return ${signedPct(h.expectedReturnPct)}.`;
}
