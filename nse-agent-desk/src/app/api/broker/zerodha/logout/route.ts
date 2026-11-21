import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, endSession, unseal } from "@/lib/broker/zerodha";

export const dynamic = "force-dynamic";

/** Ends the Zerodha session and forgets it. */
export async function POST() {
  const s = unseal((await cookies()).get(COOKIE)?.value);
  if (s) await endSession(s.token);
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete(COOKIE);
  return res;
}
