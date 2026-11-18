import { newPosition, telegramEnabled } from "@/lib/positions/monitor";
import { readState, update } from "@/lib/positions/store";

export const dynamic = "force-dynamic";

const SYMBOL = /^[A-Z0-9&.\-]{1,20}$/;

/** All positions, recent alerts and monitor settings. */
export async function GET() {
  const s = await readState();
  return Response.json({
    positions: s.positions, alerts: s.alerts.slice(-100).reverse(), lastRunAt: s.lastRunAt ?? null,
    monitor: { enabled: process.env.POSITION_MONITOR_ENABLED !== "false", minutes: Number(process.env.POSITION_CHECK_MINUTES ?? 5) || 5, telegram: telegramEnabled() },
  });
}

/** Start tracking a trade. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const symbol = String(b?.symbol ?? "").trim().toUpperCase();
  const qty = Math.floor(Number(b?.qty)), buyPrice = Number(b?.buyPrice), stop = Number(b?.stop), target = Number(b?.target);
  if (!SYMBOL.test(symbol)) return Response.json({ error: "Invalid symbol" }, { status: 400 });
  if (!(qty > 0 && qty <= 1e7)) return Response.json({ error: "Quantity must be a whole number above 0" }, { status: 400 });
  if (!(buyPrice > 0 && stop > 0 && target > 0)) return Response.json({ error: "Prices must be above 0" }, { status: 400 });
  if (!(stop < buyPrice && buyPrice < target)) return Response.json({ error: "Stop-loss must be below the buy price, and the target above it" }, { status: 400 });
  const cap = ["Large", "Mid", "Small", "Unknown"].includes(b?.cap) ? b.cap : undefined;
  const sector = typeof b?.sector === "string" && /^[A-Za-z &]{1,30}$/.test(b.sector) ? b.sector : undefined;
  const p = newPosition({ symbol, qty, buyPrice, stop, target, feed: b?.feed === "live" ? "live" : "demo", sector, cap });
  await update((s) => { s.positions.unshift(p); });
  return Response.json({ position: p }, { status: 201 });
}
