/**
 * Position monitor: checks every open position's price and sends follow-up
 * alerts (in-app, and Telegram if configured).
 *
 *  - live positions: every POSITION_CHECK_MINUTES (default 5) during NSE hours
 *  - demo positions: every minute, any time (their price feed is simulated)
 *
 * Runs in the Next.js server process, started from src/instrumentation.ts.
 * Turn it off with POSITION_MONITOR_ENABLED=false.
 */
import { randomUUID } from "node:crypto";
import { marketStatus } from "../market/calendar";
import { exitPlan, evaluate } from "./rules";
import { currentPrice } from "./prices";
import { readState, update } from "./store";
import type { Position, PositionAlert } from "./types";

const minutes = () => Math.max(1, Number(process.env.POSITION_CHECK_MINUTES ?? 5) || 5);
export const telegramEnabled = () => Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

async function sendTelegram(a: PositionAlert) {
  if (!telegramEnabled()) return;
  const icon = { critical: "🔴", warning: "🟠", good: "🟢", info: "🔵" }[a.severity];
  try {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: `${icon} ${a.title}\n${a.text}\n— ${a.from}, NSE Agent Desk` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.warn("[nse-agent-desk] Telegram alert failed:", (e as Error).message);
  }
}

/** Check one position against a price; returns the new alerts. */
export function applyPrice(p: Position, price: number, at = new Date()): PositionAlert[] {
  const r = evaluate(p, price);
  p.sent = r.sent; p.stop = r.stop; p.stopAtCost = r.stopAtCost;
  p.lastPrice = price; p.lastCheckedAt = at.toISOString();
  p.high = Math.max(p.high ?? price, price); p.low = Math.min(p.low ?? price, price);
  return r.fired.map((f) => ({
    id: randomUUID(), positionId: p.id, symbol: p.symbol, ...f, price, at: at.toISOString(), read: false,
  }));
}

/** Check open positions now. `which` limits it to demo or live ones. */
export async function checkPositions(which: "all" | "demo" | "live" = "all"): Promise<PositionAlert[]> {
  // Fetch prices outside the store lock, then apply them inside it.
  const open = (await readState()).positions.filter((p) => p.status === "open" && (which === "all" || p.feed === which));
  if (!open.length) return [];
  const prices = new Map<string, number>();
  await Promise.all(open.map(async (p) => {
    try { prices.set(p.id, await currentPrice(p)); } catch (e) { console.warn(`[nse-agent-desk] no price for ${p.symbol}:`, (e as Error).message); }
  }));
  const fresh = await update((s) => {
    const out: PositionAlert[] = [];
    for (const p of s.positions) {
      const price = prices.get(p.id);
      if (price !== undefined && p.status === "open") out.push(...applyPrice(p, price));
    }
    s.alerts.push(...out);
    s.lastRunAt = new Date().toISOString();
    return out;
  });
  for (const a of fresh) await sendTelegram(a);
  return fresh;
}

export function newPosition(input: { symbol: string; qty: number; buyPrice: number; stop: number; target: number; feed: "demo" | "live"; sector?: string; cap?: Position["cap"] }): Position {
  const { partial } = exitPlan(input.buyPrice, input.stop, input.target);
  return {
    id: randomUUID(), symbol: input.symbol, sector: input.sector, cap: input.cap, qty: input.qty, buyPrice: input.buyPrice, stop: input.stop,
    partial: Math.min(partial, input.target), target: input.target,
    openedAt: new Date().toISOString(), feed: input.feed, status: "open", sent: [],
  };
}

let started = false;
let lastLive = 0;
export function startMonitor() {
  if (started || process.env.POSITION_MONITOR_ENABLED === "false") return;
  started = true;
  console.log(`[nse-agent-desk] position monitor on: live positions every ${minutes()} min in market hours, demo every minute`);
  const tick = async () => {
    try {
      await checkPositions("demo");
      if (marketStatus().open && Date.now() - lastLive >= minutes() * 60000) {
        lastLive = Date.now();
        await checkPositions("live");
      }
    } catch (e) {
      console.error("[nse-agent-desk] position check failed:", (e as Error).message);
    }
  };
  setInterval(tick, 60_000).unref?.();
}
