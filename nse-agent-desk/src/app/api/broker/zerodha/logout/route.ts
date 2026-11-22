import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieName, endSession, kiteApp, unseal } from "@/lib/broker/zerodha";

export const dynamic = "force-dynamic";

/** Ends one account's Zerodha session (?slot=1..5) and forgets it. */
export async function POST(req: Request) {
  const slot = Number(new URL(req.url).searchParams.get("slot") ?? 1);
  const app = kiteApp(slot);
  const res = new NextResponse(null, { status: 204 });
  if (!app) return res;
  const s = unseal((await cookies()).get(cookieName(slot))?.value, Date.now(), app.secret);
  if (s) await endSession(s.token, app);
  res.cookies.delete(cookieName(slot));
  return res;
}
