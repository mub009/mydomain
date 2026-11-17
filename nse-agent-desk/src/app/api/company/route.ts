import { companyReport, peerRows } from "@/lib/company";

export const dynamic = "force-dynamic";

const SYMBOL = /^[A-Z0-9&.\-]{1,20}$/;

/**
 * GET /api/company?symbol=TCS&price=3500&demo=1&seed=42&peers=INFY:1500,WIPRO:480
 * Balance sheet, cash-flow quality and shareholding for one stock, plus ratios for its peers.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const symbol = (q.get("symbol") ?? "").toUpperCase();
  const price = Number(q.get("price"));
  const demo = q.get("demo") === "1";
  const seed = Number(q.get("seed") ?? 0) || 0;
  if (!SYMBOL.test(symbol) || !(price > 0)) return Response.json({ error: "symbol and price are required" }, { status: 400 });
  const peers = (q.get("peers") ?? "").split(",").filter(Boolean).slice(0, 6).map((x) => {
    const [s, p] = x.split(":");
    return { symbol: s.toUpperCase(), price: Number(p) };
  }).filter((p) => SYMBOL.test(p.symbol) && p.price > 0);
  const [report, peerData] = await Promise.all([companyReport(symbol, { demo, price, seed }), peerRows(peers, { demo, seed })]);
  return Response.json({ report, peers: peerData });
}
