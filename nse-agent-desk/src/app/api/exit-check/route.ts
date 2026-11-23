import { NextResponse } from "next/server";
import { ACTION_ORDER, exitAdvice, mergeHoldings, type ExitAdvice, type Holding } from "@/lib/exit-check";
import { MIDCAP_SECTORS, NIFTY50, NIFTY50_SECTORS, SMALLCAP_SECTORS } from "@/lib/market/universe";
import { searchStocks } from "@/lib/market/search";
import { runAnalysis } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const KNOWN: Record<string, string> = { ...SMALLCAP_SECTORS, ...MIDCAP_SECTORS, ...NIFTY50_SECTORS };
const SYMBOL = /^[A-Z0-9&.\-]{1,20}$/;

/**
 * POST /api/exit-check { holdings: [{ symbol, qty, avgPrice, source }] }
 * The agents research every stock you hold (with a few Nifty leaders for
 * comparison) and say whether to sell, book profit or keep holding.
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as { holdings?: Holding[] } | null;
  const list = (Array.isArray(b?.holdings) ? b!.holdings : []).slice(0, 80)
    .map((h) => ({ symbol: String(h.symbol ?? "").trim().toUpperCase(), qty: Number(h.qty), avgPrice: Number(h.avgPrice), source: String(h.source ?? "").slice(0, 60) }))
    .filter((h) => SYMBOL.test(h.symbol));
  const held = mergeHoldings(list);
  if (!held.size) return NextResponse.json({ error: "No holdings to check." }, { status: 400 });
  if (held.size > 60) return NextResponse.json({ error: "Up to 60 different stocks can be checked at once." }, { status: 400 });

  const symbols = [...held.keys()];
  // Sectors for stocks outside the built-in lists (lenders get the lender checks, etc.).
  const sectors: Record<string, string> = {};
  await Promise.all(symbols.filter((s) => !KNOWN[s]).slice(0, 20).map(async (s) => {
    const sec = (await searchStocks(s).catch(() => null))?.stocks.find((h) => h.symbol === s)?.sector;
    if (sec) sectors[s] = sec;
  }));
  // A few leaders for comparison (sector strength, valuation medians); never shown.
  const fill = NIFTY50.filter((s) => !held.has(s)).slice(0, Math.max(3, 8 - symbols.length));

  try {
    const result = await runAnalysis({ symbols: [...symbols, ...fill], top: 5, demo: false, aiNotes: false, riskPerTrade: 1, sectors, focus: symbols }, () => {});
    const advice: ExitAdvice[] = [];
    const missing: { symbol: string; why: string }[] = [];
    for (const [sym, h] of held) {
      const d = result.all.find((x) => x.symbol === sym);
      if (!d) {
        const ex = result.excluded.find((e) => e.symbol === sym);
        missing.push({ symbol: sym, why: ex ? `market cap ₹${ex.marketCapCr.toLocaleString("en-IN")} Cr is below the ₹${result.minCapCr} Cr the agents cover` : "no price data (check the symbol, or it may be an ETF, bond or new listing)" });
        continue;
      }
      advice.push(exitAdvice(d, h));
    }
    advice.sort((a, b) => ACTION_ORDER[a.action] - ACTION_ORDER[b.action] || a.pnlPct - b.pnlPct);
    return NextResponse.json({ advice, missing, at: result.generatedAt, source: result.source.label });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
