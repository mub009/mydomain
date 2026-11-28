import { NextResponse } from "next/server";
import { liveQuotes } from "@/lib/market/quotes";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SYMBOL = /^[A-Z0-9&\-]{1,20}$/;

/** GET /api/quotes?symbols=TCS,INFY: current (delayed) prices, up to 300 symbols. */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("symbols") ?? "";
  const symbols = [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter((s) => SYMBOL.test(s)))].slice(0, 300);
  if (!symbols.length) return NextResponse.json({ error: "symbols is required" }, { status: 400 });
  return NextResponse.json({ quotes: await liveQuotes(symbols) }, { headers: { "Cache-Control": "no-store" } });
}
