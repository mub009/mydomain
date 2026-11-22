import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { kiteApp, kiteApps, loginUrl } from "@/lib/broker/zerodha";

export const dynamic = "force-dynamic";

/** Sends you to Zerodha's own login page for one account (?slot=1..5), with a one-time value checked on the way back. */
export async function GET(req: Request) {
  const slot = Number(new URL(req.url).searchParams.get("slot") ?? kiteApps()[0]?.slot ?? 1);
  const app = kiteApp(slot);
  if (!app) return NextResponse.redirect(new URL("/positions?broker=not-configured", req.url));
  const state = `${slot}.${randomBytes(16).toString("hex")}`;
  const res = NextResponse.redirect(`${loginUrl(app.key)}&redirect_params=${encodeURIComponent(`state=${state}`)}`);
  res.cookies.set("kite_state", state, { httpOnly: true, secure: new URL(req.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
