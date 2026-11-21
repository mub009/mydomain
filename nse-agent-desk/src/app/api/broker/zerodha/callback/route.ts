import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, createSession, kiteConfigured, seal } from "@/lib/broker/zerodha";

export const dynamic = "force-dynamic";

/** Zerodha sends you back here after login with a one-time request token. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/positions?broker=${q}`, req.url));
  const token = u.searchParams.get("request_token");
  if (!kiteConfigured()) return back("not-configured");
  if (u.searchParams.get("status") !== "success" || !token || !/^[A-Za-z0-9]{6,64}$/.test(token)) return back("cancelled");
  // Only finish a login this browser started.
  const state = (await cookies()).get("kite_state")?.value;
  if (!state || u.searchParams.get("state") !== state) return back("failed");
  try {
    const s = await createSession(token);
    const res = back("connected");
    res.cookies.delete("kite_state");
    res.cookies.set(COOKIE, seal(s), { httpOnly: true, secure: u.protocol === "https:", sameSite: "lax", path: "/", expires: new Date(s.exp) });
    return res;
  } catch (e) {
    console.warn("[nse-agent-desk] Zerodha login failed:", (e as Error).message);
    return back("failed");
  }
}
