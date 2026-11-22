import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieName, KiteError, kiteApps, portfolio, sealAll, unsealAll, type KiteSession } from "@/lib/broker/zerodha";

export const dynamic = "force-dynamic";

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Every Zerodha account connected in this browser, with its holdings and today's
 * positions (read-only), and the apps set up on the server (for Connect buttons).
 */
export async function GET(req: Request) {
  const apps = kiteApps();
  if (!apps.length) return NextResponse.json({ configured: false, apps: [], accounts: [] });
  const jar = await cookies();
  const rewrite: { slot: number; keep: KiteSession[]; secret: string }[] = [];
  const accounts = (await Promise.all(apps.map(async (app) => {
    const list = unsealAll(jar.get(cookieName(app.slot))?.value, Date.now(), app.secret);
    const expired: string[] = [];
    const out = await Promise.all(list.map(async (s) => {
      const base = { slot: app.slot, connected: true, user: { id: s.userId, name: s.name }, expiresAt: new Date(s.exp).toISOString() };
      try { return { ...base, ...(await portfolio(s.token, app.key)) }; }
      catch (e) {
        const err = e as KiteError;
        if (err.status === 403 || err.type === "TokenException") { expired.push(s.userId); return null; }
        return { ...base, error: err.message };
      }
    }));
    if (expired.length) rewrite.push({ slot: app.slot, keep: list.filter((s) => !expired.includes(s.userId)), secret: app.secret });
    return out.filter(Boolean);
  }))).flat();

  type T = { invested: number; value: number; dayPnl: number; positionsPnl: number };
  const t = accounts.flatMap((a) => (a && "totals" in a && a.totals ? [a.totals as T] : []));
  const sum = (k: keyof T) => r2(t.reduce((s, x) => s + x[k], 0));
  const combined = t.length > 1 ? { invested: sum("invested"), value: sum("value"), pnl: r2(sum("value") - sum("invested")), pnlPct: sum("invested") ? r2(((sum("value") - sum("invested")) / sum("invested")) * 100) : 0, dayPnl: sum("dayPnl"), positionsPnl: sum("positionsPnl") } : undefined;
  const res = NextResponse.json({
    configured: true, apps: apps.map((a) => a.slot), accounts, combined, expired: rewrite.length > 0,
    at: new Date().toISOString(),
  });
  // Forget sessions Zerodha has ended (they end at 06:00 IST).
  for (const w of rewrite) {
    if (w.keep.length) res.cookies.set(cookieName(w.slot), sealAll(w.keep, w.secret), { httpOnly: true, secure: new URL(req.url).protocol === "https:", sameSite: "lax", path: "/", expires: new Date(Math.max(...w.keep.map((x) => x.exp))) });
    else res.cookies.delete(cookieName(w.slot));
  }
  return res;
}
