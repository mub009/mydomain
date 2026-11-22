import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieName, KiteError, kiteApps, portfolio, unseal } from "@/lib/broker/zerodha";

export const dynamic = "force-dynamic";

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Every Zerodha account set up on the server: whether it's connected and, if so, its holdings and today's positions (read-only). */
export async function GET() {
  const apps = kiteApps();
  if (!apps.length) return NextResponse.json({ configured: false, accounts: [] });
  const jar = await cookies();
  const drop: string[] = [];
  const accounts = await Promise.all(apps.map(async (app) => {
    const s = unseal(jar.get(cookieName(app.slot))?.value, Date.now(), app.secret);
    if (!s) return { slot: app.slot, connected: false };
    try {
      const data = await portfolio(s.token, app.key);
      return { slot: app.slot, connected: true, user: { id: s.userId, name: s.name }, expiresAt: new Date(s.exp).toISOString(), ...data };
    } catch (e) {
      const err = e as KiteError;
      if (err.status === 403 || err.type === "TokenException") { drop.push(cookieName(app.slot)); return { slot: app.slot, connected: false, expired: true }; }
      return { slot: app.slot, connected: true, user: { id: s.userId, name: s.name }, error: err.message };
    }
  }));
  // All connected accounts together.
  const t = accounts.flatMap((a) => ("totals" in a && a.totals ? [a.totals] : []));
  const sum = (k: "invested" | "value" | "dayPnl" | "positionsPnl") => r2(t.reduce((s, x) => s + x[k], 0));
  const combined = t.length > 1 ? { invested: sum("invested"), value: sum("value"), pnl: r2(sum("value") - sum("invested")), pnlPct: sum("invested") ? r2(((sum("value") - sum("invested")) / sum("invested")) * 100) : 0, dayPnl: sum("dayPnl"), positionsPnl: sum("positionsPnl") } : undefined;
  const res = NextResponse.json({ configured: true, accounts, combined, at: new Date().toISOString() });
  for (const c of drop) res.cookies.delete(c);
  return res;
}
