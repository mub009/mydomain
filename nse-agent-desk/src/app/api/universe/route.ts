import { NextResponse } from "next/server";
import { isBigUniverse, loadStockList } from "@/lib/market/lists";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET /api/universe?list=nifty500|allnse: how many stocks the list has and where it came from. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("list");
  if (!isBigUniverse(id)) return NextResponse.json({ error: "list must be nifty500 or allnse" }, { status: 400 });
  const l = await loadStockList(id);
  const sectors = Object.values(l.sectors).reduce<Record<string, number>>((m, s) => ((m[s] = (m[s] ?? 0) + 1), m), {});
  return NextResponse.json({ id: l.id, label: l.label, count: l.symbols.length, from: l.from, note: l.note, sample: l.symbols.slice(0, 10), sectors });
}
