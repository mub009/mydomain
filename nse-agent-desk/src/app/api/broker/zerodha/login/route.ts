import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { kiteConfigured, loginUrl } from "@/lib/broker/zerodha";

export const dynamic = "force-dynamic";

/** Sends you to Zerodha's own login page, with a one-time value checked on the way back. */
export async function GET(req: Request) {
  if (!kiteConfigured()) return NextResponse.redirect(new URL("/positions?broker=not-configured", req.url));
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(`${loginUrl(process.env.KITE_API_KEY!)}&redirect_params=${encodeURIComponent(`state=${state}`)}`);
  res.cookies.set("kite_state", state, { httpOnly: true, secure: new URL(req.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
