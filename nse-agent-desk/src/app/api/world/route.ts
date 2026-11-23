import { NextResponse } from "next/server";
import { worldQuotes } from "@/lib/world";

export const dynamic = "force-dynamic";

/** GET /api/world: the main stock index of each country, delayed, cached 2 minutes. */
export async function GET() {
  return NextResponse.json({ indices: await worldQuotes(), source: "Yahoo Finance (delayed)", at: new Date().toISOString() });
}
