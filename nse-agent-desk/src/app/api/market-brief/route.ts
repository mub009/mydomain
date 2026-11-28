import { NextResponse } from "next/server";
import { marketBrief } from "@/lib/market-brief";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/market-brief: why the Nifty, Sensex, Bank Nifty, gold and silver moved, plus the last 10 sessions. */
export async function GET() {
  try { return NextResponse.json(await marketBrief()); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
}
