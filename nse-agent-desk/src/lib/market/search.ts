/**
 * Stock search for building your own group: company names and symbols from
 * Yahoo Finance's search (NSE listings only), plus the built-in lists and
 * whole-sector groups.
 */
import { COMPANY_NAMES } from "../news";
import { MIDCAP_SECTORS, NIFTY50_SECTORS, SMALLCAP_SECTORS } from "./universe";

export interface StockHit { symbol: string; name: string; sector?: string; industry?: string }
export interface GroupHit { name: string; symbols: string[] }
export interface SearchResult { stocks: StockHit[]; groups: GroupHit[]; source: string }

const KNOWN: Record<string, string> = { ...SMALLCAP_SECTORS, ...MIDCAP_SECTORS, ...NIFTY50_SECTORS };

/** Map Yahoo's sector and industry to the app's sector names. */
export function appSector(sector?: string, industry?: string): string | undefined {
  const i = (industry ?? "").toLowerCase();
  switch (sector) {
    case "Financial Services": return /bank/.test(i) ? "Banks" : "Financials";
    case "Technology": return /software|information|it services/.test(i) ? "IT" : "Capital Goods";
    case "Healthcare": return /drug|pharma|biotech/.test(i) ? "Pharma" : "Healthcare";
    case "Consumer Cyclical": return /auto|vehicle/.test(i) ? "Auto" : /textile|apparel/.test(i) ? "Textiles" : /real estate|residential/.test(i) ? "Realty" : "Consumer";
    case "Consumer Defensive": return "FMCG";
    case "Industrials": return /construction|engineering|infrastructure|railroad|marine|airport/.test(i) ? "Infrastructure" : "Capital Goods";
    case "Basic Materials": return /steel|metal|aluminum|copper|mining/.test(i) ? "Metals" : /cement|building materials/.test(i) ? "Cement" : "Chemicals";
    case "Energy": return "Energy";
    case "Utilities": return "Utilities";
    case "Real Estate": return "Realty";
    case "Communication Services": return /telecom/.test(i) ? "Telecom" : "Consumer";
    default: return undefined;
  }
}

/** Built-in matches: symbol prefix, known company names, and whole sectors. */
export function localSearch(q: string): SearchResult {
  const s = q.trim().toLowerCase();
  if (!s) return { stocks: [], groups: [], source: "built-in" };
  const stocks: StockHit[] = [];
  for (const [sym, sector] of Object.entries(KNOWN)) {
    const names = COMPANY_NAMES[sym] ?? [];
    if (sym.toLowerCase().startsWith(s) || names.some((n) => n.toLowerCase().includes(s))) stocks.push({ symbol: sym, name: names[0] ?? sym, sector });
  }
  const bySector: Record<string, string[]> = {};
  for (const [sym, sector] of Object.entries(KNOWN)) (bySector[sector] ??= []).push(sym);
  const groups = Object.entries(bySector)
    .filter(([sector]) => sector.toLowerCase().includes(s) || (s.length >= 3 && s.includes(sector.toLowerCase().replace(/s$/, ""))))
    .map(([sector, symbols]) => ({ name: `${sector} (built-in list)`, symbols }));
  return { stocks: stocks.slice(0, 8), groups, source: "built-in" };
}

async function yahooSearch(q: string): Promise<StockHit[]> {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&listsCount=0&region=IN&lang=en-IN`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  type Q = { symbol?: string; exchange?: string; quoteType?: string; shortname?: string; longname?: string; sector?: string; industry?: string };
  const quotes: Q[] = (await res.json())?.quotes ?? [];
  return quotes
    // NSE equities only; skip special series such as block-deal (-BL) and trade-for-trade (-BE) listings
    .filter((x) => x.exchange === "NSI" && x.quoteType === "EQUITY" && x.symbol?.endsWith(".NS") && !/-(BL|BE|BZ|SM|ST|IL)\.NS$/.test(x.symbol))
    .map((x) => {
      const symbol = x.symbol!.slice(0, -3);
      return { symbol, name: x.longname ?? x.shortname ?? symbol, sector: KNOWN[symbol] ?? appSector(x.sector, x.industry), industry: x.industry };
    });
}

/** Companies that changed their listed name or split, so old names still find them. */
const RENAMED: Record<string, string> = {
  zomato: "ETERNAL", "tata motors": "TMPV", tatamotors: "TMPV", "tata motors cv": "TMCV", "tata motors commercial": "TMCV",
};

export async function searchStocks(q: string): Promise<SearchResult> {
  const local = localSearch(q);
  try {
    const alias = RENAMED[q.trim().toLowerCase()];
    const live = alias ? [...(await yahooSearch(alias)).filter((x) => x.symbol === alias), ...(await yahooSearch(q))] : await yahooSearch(q);
    const seen = new Set<string>();
    const stocks = [...live, ...local.stocks].filter((x) => !seen.has(x.symbol) && Boolean(seen.add(x.symbol)));
    return { stocks: stocks.slice(0, 10), groups: local.groups, source: "Yahoo Finance search" };
  } catch {
    return local; // offline: built-in lists only
  }
}
