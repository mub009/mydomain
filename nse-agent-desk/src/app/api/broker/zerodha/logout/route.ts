import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieName, endSession, kiteApp, sealAll, unsealAll } from "@/lib/broker/zerodha";

export const dynamic = "force-dynamic";

/** Ends one Zerodha account's session (?slot=1..5&user=CLIENTID) and forgets it; without user, all of that app's accounts. */
export async function POST(req: Request) {
  const u = new URL(req.url);
  const slot = Number(u.searchParams.get("slot") ?? 1), user = u.searchParams.get("user");
  const app = kiteApp(slot);
  const res = new NextResponse(null, { status: 204 });
  if (!app) return res;
  const list = unsealAll((await cookies()).get(cookieName(slot))?.value, Date.now(), app.secret);
  const [gone, keep] = [list.filter((s) => !user || s.userId === user), list.filter((s) => user && s.userId !== user)];
  await Promise.all(gone.map((s) => endSession(s.token, app)));
  if (keep.length) res.cookies.set(cookieName(slot), sealAll(keep, app.secret), { httpOnly: true, secure: u.protocol === "https:", sameSite: "lax", path: "/", expires: new Date(Math.max(...keep.map((x) => x.exp))) });
  else res.cookies.delete(cookieName(slot));
  return res;
}
