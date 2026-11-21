import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, KiteError, kiteConfigured, portfolio, unseal } from "@/lib/broker/zerodha";

export const dynamic = "force-dynamic";

/** Connection status and, when connected, your holdings and today's positions (read-only). */
export async function GET() {
  if (!kiteConfigured()) return NextResponse.json({ configured: false, connected: false });
  const s = unseal((await cookies()).get(COOKIE)?.value);
  if (!s) return NextResponse.json({ configured: true, connected: false });
  try {
    const data = await portfolio(s.token);
    return NextResponse.json({ configured: true, connected: true, user: { id: s.userId, name: s.name }, expiresAt: new Date(s.exp).toISOString(), at: new Date().toISOString(), ...data });
  } catch (e) {
    const err = e as KiteError;
    if (err.status === 403 || err.type === "TokenException") { // session ended or revoked: log in again
      const res = NextResponse.json({ configured: true, connected: false, expired: true });
      res.cookies.delete(COOKIE);
      return res;
    }
    return NextResponse.json({ configured: true, connected: true, user: { id: s.userId, name: s.name }, error: err.message }, { status: 502 });
  }
}
