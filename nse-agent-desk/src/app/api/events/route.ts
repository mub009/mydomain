import { NextResponse } from "next/server";
import { upcomingEvents } from "@/lib/events";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** GET /api/events?scope=india|global[&symbols=TCS,INFY]: upcoming results, ex-dividend and dividend payment dates. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const scope = u.searchParams.get("scope") === "global" ? "Global" : "India";
  const symbols = (u.searchParams.get("symbols") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9&.-]{1,20}$/.test(s)).slice(0, 150);
  const events = await upcomingEvents(scope, symbols.length ? symbols : undefined);
  return NextResponse.json({ scope, events, at: new Date().toISOString() });
}
