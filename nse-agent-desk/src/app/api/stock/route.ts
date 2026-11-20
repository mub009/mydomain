import { NextResponse } from "next/server";
import { MIDCAP_SECTORS, NIFTY50, NIFTY50_SECTORS, SMALLCAP_SECTORS } from "@/lib/market/universe";
import { runAnalysis } from "@/lib/pipeline";
import { searchStocks } from "@/lib/market/search";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const KNOWN: Record<string, string> = { ...SMALLCAP_SECTORS, ...MIDCAP_SECTORS, ...NIFTY50_SECTORS };
const SYMBOL = /^[A-Z0-9&.\-]{1,20}$/;

/**
 * POST /api/stock { symbol, sector? }: research one NSE stock in full.
 * The agents need context (sector peers for the sector check, valuation
 * medians and relative strength), so the stock is analysed together with up
 * to 9 peers from the same sector, topped up with Nifty 50 leaders.
 */
export async function POST(req: Request) {
  let body: { symbol?: unknown; sector?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const symbol = String(body.symbol ?? "").trim().toUpperCase();
  if (!SYMBOL.test(symbol)) return NextResponse.json({ error: "Enter a valid NSE symbol" }, { status: 400 });
  let sector: string | undefined = typeof body.sector === "string" && /^[A-Za-z &]{2,30}$/.test(body.sector) ? body.sector : KNOWN[symbol];
  // No sector given: look it up, so lenders get the lender checks and the sector check has peers.
  if (!sector) sector = (await searchStocks(symbol).catch(() => null))?.stocks.find((h) => h.symbol === symbol)?.sector;
  const peers = sector ? Object.keys(KNOWN).filter((s) => KNOWN[s] === sector && s !== symbol).slice(0, 9) : [];
  const fill = NIFTY50.filter((s) => s !== symbol && !peers.includes(s)).slice(0, Math.max(0, 8 - peers.length));
  const symbols = [symbol, ...peers, ...fill];
  try {
    const result = await runAnalysis({
      symbols, top: 5, demo: false, aiNotes: false, riskPerTrade: 1, capital: 500000,
      sectors: sector ? { [symbol]: sector } : undefined, focus: [symbol],
    }, () => {});
    const found = result.all.find((d) => d.symbol === symbol);
    if (!found) {
      const ex = result.excluded.find((e) => e.symbol === symbol);
      const skip = result.skipped.find((s) => s.startsWith(`${symbol} `));
      const why = ex ? `its market cap (₹${ex.marketCapCr.toLocaleString("en-IN")} Cr) is below the ₹${result.minCapCr} Cr minimum`
        : skip && /not enough history/.test(skip) ? "Yahoo Finance has too little price history for it (new listings need about 3 months)"
        : skip ? "it isn't an NSE symbol Yahoo Finance knows. Check the spelling or search by company name"
        : "its data could not be loaded";
      return NextResponse.json({ error: `${symbol} could not be analysed: ${why}.` }, { status: 422 });
    }
    // The peers are only there for comparison: the searched stock isn't competing with them for
    // a place in a top-5 list, so drop "left out" reasons that come from that list.
    if (found.passedOver) {
      found.passedOver = undefined;
      if (found.blackPoints?.finalDecision) found.blackPoints.finalDecision = found.blackPoints.finalDecision.replace(/ Not chosen: .*$/, ` Rated ${found.verdict} on its own (peers were only used for comparison).`);
    }
    result.picks = result.picks.filter((d) => d.symbol === symbol);
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
