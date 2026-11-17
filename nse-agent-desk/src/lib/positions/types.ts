import type { CapSize, Person } from "../types";

export interface Position {
  id: string;
  symbol: string;
  /** Saved when tracking, for the diversification check. */
  sector?: string;
  cap?: CapSize;
  qty: number;
  buyPrice: number;
  stop: number;
  /** First exit: book half here (buy price + 1× risk). */
  partial: number;
  target: number;
  openedAt: string;
  /** "demo" positions use a simulated price feed. */
  feed: "demo" | "live";
  status: "open" | "closed";
  /** Set once the price reached the first exit and the stop moved to the buy price. */
  stopAtCost?: boolean;
  lastPrice?: number;
  lastCheckedAt?: string;
  high?: number;
  low?: number;
  exitPrice?: number;
  closedAt?: string;
  /** Alert kinds already sent, so each fires once (near-stop re-arms after a recovery). */
  sent: AlertKind[];
}

export type AlertKind = "loss" | "near-stop" | "stop-hit" | "partial" | "near-target" | "target-hit";
export type Severity = "critical" | "warning" | "good" | "info";

export interface PositionAlert {
  id: string;
  positionId: string;
  symbol: string;
  kind: AlertKind;
  severity: Severity;
  from: Person;
  title: string;
  text: string;
  price: number;
  at: string;
  read: boolean;
}

export interface PositionsState {
  positions: Position[];
  alerts: PositionAlert[];
  lastRunAt?: string;
}
