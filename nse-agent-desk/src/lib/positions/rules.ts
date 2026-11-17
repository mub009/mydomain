/**
 * Follow-up rules for a tracked position. Pure functions, so they're easy to test.
 *
 *  stop-hit     price at or below the stop-loss              → exit now          (Lotappi, critical)
 *  near-stop    within 1% above the stop                     → get ready to exit (Lotappi, warning)
 *  loss         3% or more below the buy price               → in loss           (Lotappi, warning)
 *  partial      at buy + 1× risk (the first exit)            → book half, move stop to cost (Mayavi, good)
 *  near-target  within 2% of the target                      → exit area close   (Mayavi, info)
 *  target-hit   at or above the target                       → exit              (Mayavi, good)
 *
 * Each alert fires once per position; "near-stop" fires again if the price
 * recovers at least 2% above the stop and then falls back.
 */
import { inr } from "../format";
import type { AlertKind, Position, PositionAlert, Severity } from "./types";
import type { Person } from "../types";

export function exitPlan(buyPrice: number, stop: number, target: number) {
  const risk = buyPrice - stop;
  return { risk, partial: Math.round((buyPrice + risk) * 100) / 100, target };
}

export interface Fired { kind: AlertKind; severity: Severity; from: Person; title: string; text: string }

export function evaluate(p: Position, price: number): { fired: Fired[]; sent: AlertKind[]; stop: number; stopAtCost: boolean } {
  const fired: Fired[] = [];
  let sent = [...p.sent];
  let stop = p.stop, stopAtCost = Boolean(p.stopAtCost);
  const pnlPct = (price / p.buyPrice - 1) * 100;
  const once = (k: AlertKind) => !sent.includes(k);
  const fire = (kind: AlertKind, severity: Severity, from: Person, title: string, text: string) => {
    fired.push({ kind, severity, from, title, text }); sent.push(kind);
  };
  const pnl = `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}% (${inr((price - p.buyPrice) * p.qty, 0)} on ${p.qty} shares)`;

  // re-arm near-stop after a real recovery
  if (sent.includes("near-stop") && price >= stop * 1.02) sent = sent.filter((k) => k !== "near-stop");

  if (price <= stop) {
    if (once("stop-hit")) {
      fire("stop-hit", "critical", "Lotappi", `${p.symbol}: stop-loss hit, exit now`,
        `${p.symbol} is at ${inr(price)}, at or below your stop-loss ${inr(stop)}${stopAtCost ? " (moved to your buy price)" : ""}. Exit the position. Result: ${pnl}.`);
    }
  } else if (price <= stop * 1.01) {
    if (once("near-stop")) {
      fire("near-stop", "warning", "Lotappi", `${p.symbol}: close to stop-loss`,
        `${p.symbol} is at ${inr(price)}, within 1% of your stop-loss ${inr(stop)}. Be ready to exit. Now ${pnl}.`);
    }
  }

  if (pnlPct <= -3 && price > stop && once("loss")) {
    fire("loss", "warning", "Lotappi", `${p.symbol}: in loss ${pnlPct.toFixed(1)}%`,
      `${p.symbol} is ${Math.abs(pnlPct).toFixed(1)}% below your buy price ${inr(p.buyPrice)} (now ${inr(price)}). The stop-loss is ${inr(stop)}; don't move it lower.`);
  }

  if (price >= p.partial && price < p.target && once("partial")) {
    stop = p.buyPrice; stopAtCost = true;
    fire("partial", "good", "Mayavi", `${p.symbol}: first exit reached`,
      `${p.symbol} reached ${inr(price)}, your first exit ${inr(p.partial)} (1× risk). Book half (${Math.floor(p.qty / 2)} shares) and move the stop-loss up to your buy price ${inr(p.buyPrice)}, so the rest can't turn into a loss. Now ${pnl}.`);
  }

  if (price >= p.target * 0.98 && price < p.target && once("near-target")) {
    fire("near-target", "info", "Mayavi", `${p.symbol}: near the exit area`,
      `${p.symbol} is at ${inr(price)}, within 2% of the target ${inr(p.target)}. Get ready to exit. Now ${pnl}.`);
  }

  if (price >= p.target && once("target-hit")) {
    fire("target-hit", "good", "Mayavi", `${p.symbol}: target reached, exit`,
      `${p.symbol} reached ${inr(price)}, at or above the target ${inr(p.target)}. Exit the position (or keep a small part with the stop at ${inr(Math.max(stop, p.partial))}). Result: ${pnl}.`);
  }

  return { fired, sent, stop, stopAtCost };
}

/** Where the price sits between stop (0%) and target (100%), for the progress bar. */
export const progress = (p: Position, price: number) =>
  Math.max(0, Math.min(100, ((price - p.stop) / (p.target - p.stop)) * 100));

export type Health = "Stop hit" | "Near stop" | "In loss" | "Healthy" | "First exit hit" | "Near target" | "Target hit" | "Closed";
export function health(p: Position, price?: number): Health {
  if (p.status === "closed") return "Closed";
  if (price === undefined) return "Healthy";
  if (price <= p.stop) return "Stop hit";
  if (price >= p.target) return "Target hit";
  if (price >= p.target * 0.98) return "Near target";
  if (price <= p.stop * 1.01) return "Near stop";
  if (price >= p.partial) return "First exit hit";
  if (price <= p.buyPrice * 0.97) return "In loss";
  return "Healthy";
}
