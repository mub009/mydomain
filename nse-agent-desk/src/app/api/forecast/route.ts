import { forecast } from "@/lib/forecast";
import { getProvider } from "@/lib/market";
import { demoBars } from "@/lib/market/demo";
import type { Bar } from "@/lib/types";

export const dynamic = "force-dynamic";

const SYMBOL = /^[A-Z0-9&.\-]{1,20}$/;
const cache = new Map<string, { at: number; bars: Bar[] }>();

/** GET /api/forecast?symbol=TCS&horizon=10&stop=..&target=..&demo=1&seed=42 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const symbol = (q.get("symbol") ?? "").toUpperCase();
  const horizon = Number(q.get("horizon"));
  const stop = Number(q.get("stop")), target = Number(q.get("target"));
  const demo = q.get("demo") === "1", seed = Number(q.get("seed") ?? 0) || 0;
  if (!SYMBOL.test(symbol) || ![10, 21].includes(horizon) || !(stop > 0 && target > stop)) {
    return Response.json({ error: "symbol, horizon (10 or 21), stop and target are required" }, { status: 400 });
  }
  let bars: Bar[];
  if (demo) bars = demoBars(symbol, seed);
  else {
    const hit = cache.get(symbol);
    if (hit && Date.now() - hit.at < 3600_000) bars = hit.bars;
    else {
      const p = getProvider();
      if (!p) return Response.json({ error: "No market-data provider configured" }, { status: 503 });
      try { bars = await p.getDailyBars(symbol); } catch (e) { return Response.json({ error: (e as Error).message }, { status: 502 }); }
      cache.set(symbol, { at: Date.now(), bars });
    }
  }
  if (bars.length < 80) return Response.json({ error: "Not enough price history" }, { status: 422 });
  return Response.json(forecast(bars, { horizon, stop, target, seed: `${symbol}:${horizon}:${seed}` }));
}
