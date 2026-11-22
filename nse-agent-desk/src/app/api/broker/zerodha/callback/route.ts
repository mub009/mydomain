import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieName, createSession, kiteApp, kiteConfigured, seal } from "@/lib/broker/zerodha";

export const dynamic = "force-dynamic";

/** Zerodha sends you back here after login with a one-time request token. Every app uses this same redirect URL. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/positions?broker=${q}`, req.url));
  const token = u.searchParams.get("request_token");
  if (!kiteConfigured()) return back("not-configured");
  if (u.searchParams.get("status") !== "success" || !token || !/^[A-Za-z0-9]{6,64}$/.test(token)) return back("cancelled");
  // Only finish a login this browser started; the value also says which account it was.
  const state = (await cookies()).get("kite_state")?.value;
  if (!state || u.searchParams.get("state") !== state) return back("failed");
  const app = kiteApp(Number(state.split(".")[0]));
  if (!app) return back("failed");
  try {
    const s = await createSession(token, app);
    const res = back("connected");
    res.cookies.delete("kite_state");
    res.cookies.set(cookieName(app.slot), seal(s, app.secret), { httpOnly: true, secure: u.protocol === "https:", sameSite: "lax", path: "/", expires: new Date(s.exp) });
    return res;
  } catch (e) {
    console.warn(`[nse-agent-desk] Zerodha login failed (account ${app.slot}):`, (e as Error).message);
    return back("failed");
  }
}
