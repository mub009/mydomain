import { NextResponse } from "next/server";
import { searchStocks } from "@/lib/market/search";

export const dynamic = "force-dynamic";

/** GET /api/search?q=hdfc  →  NSE stocks and sector groups matching the text. */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 1) return NextResponse.json({ stocks: [], groups: [], source: "" });
  return NextResponse.json(await searchStocks(q));
}
