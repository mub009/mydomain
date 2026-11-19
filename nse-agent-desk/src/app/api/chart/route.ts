import { NextResponse } from "next/server";
import { allowed, type ChartInterval, type ChartRange, fetchChart, INTERVALS, RANGES } from "@/lib/market/chart-data";

export const dynamic = "force-dynamic";

/** GET /api/chart?symbol=RELIANCE&interval=1d&range=1y */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const symbol = (u.searchParams.get("symbol") ?? "").toUpperCase();
  const interval = (u.searchParams.get("interval") ?? "1d") as ChartInterval;
  const range = (u.searchParams.get("range") ?? "1y") as ChartRange;
  if (!/^[A-Z0-9&^.=-]{1,24}$/.test(symbol)) return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  if (!INTERVALS.includes(interval) || !RANGES.includes(range)) return NextResponse.json({ error: "Invalid interval or range" }, { status: 400 });
  if (!allowed(interval, range)) return NextResponse.json({ error: `${interval} bars are not available for ${range}` }, { status: 400 });
  try {
    return NextResponse.json(await fetchChart(symbol, interval, range));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
