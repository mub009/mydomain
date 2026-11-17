/**
 * Stock news for the News Agent agent.
 *  - demo:   fictional sample headlines built from the demo price moves (labelled "Sample")
 *  - google: Google News RSS search, matched to stocks by company name
 * Choose with NEWS_PROVIDER (google | none). Sentiment is a simple keyword
 * score: good enough to sort headlines, not a substitute for reading them.
 */
import type { NewsBrief, NewsItem, Snapshot } from "../types";

/** Names used to match a headline to a stock. */
export const COMPANY_NAMES: Record<string, string[]> = {
  RELIANCE: ["Reliance Industries", "RIL"], TCS: ["TCS", "Tata Consultancy"], HDFCBANK: ["HDFC Bank"], ICICIBANK: ["ICICI Bank"],
  INFY: ["Infosys"], BHARTIARTL: ["Bharti Airtel", "Airtel"], ITC: ["ITC"], SBIN: ["SBI", "State Bank of India"],
  LT: ["Larsen & Toubro", "L&T"], HINDUNILVR: ["Hindustan Unilever", "HUL"], BAJFINANCE: ["Bajaj Finance"], KOTAKBANK: ["Kotak Mahindra Bank", "Kotak Bank"],
  AXISBANK: ["Axis Bank"], MARUTI: ["Maruti Suzuki", "Maruti"], SUNPHARMA: ["Sun Pharma"], HCLTECH: ["HCL Tech", "HCLTech"],
  TITAN: ["Titan"], ULTRACEMCO: ["UltraTech Cement", "UltraTech"], NTPC: ["NTPC"], ASIANPAINT: ["Asian Paints"],
  "M&M": ["Mahindra & Mahindra", "M&M"], POWERGRID: ["Power Grid"], TATAMOTORS: ["Tata Motors"], WIPRO: ["Wipro"], ONGC: ["ONGC"],
  NESTLEIND: ["Nestle India"], JSWSTEEL: ["JSW Steel"], TATASTEEL: ["Tata Steel"], ADANIPORTS: ["Adani Ports"], COALINDIA: ["Coal India"],
  BAJAJFINSV: ["Bajaj Finserv"], TECHM: ["Tech Mahindra"], GRASIM: ["Grasim"], HINDALCO: ["Hindalco"], CIPLA: ["Cipla"],
  DRREDDY: ["Dr Reddy", "Dr. Reddy"], BRITANNIA: ["Britannia"], EICHERMOT: ["Eicher Motors", "Royal Enfield"], APOLLOHOSP: ["Apollo Hospitals"],
  HEROMOTOCO: ["Hero MotoCorp"], DIVISLAB: ["Divi's Lab", "Divis Lab"], TATACONSUM: ["Tata Consumer"], SBILIFE: ["SBI Life"], HDFCLIFE: ["HDFC Life"],
  BPCL: ["BPCL", "Bharat Petroleum"], INDUSINDBK: ["IndusInd Bank"], ADANIENT: ["Adani Enterprises"], "BAJAJ-AUTO": ["Bajaj Auto"],
  SHRIRAMFIN: ["Shriram Finance"], TRENT: ["Trent"],
};

const POSITIVE = ["surge", "jump", "gain", "rall", "soar", "rise", "climb", "beat", "win", "bags", "order", "upgrade", "record", "growth", "approval", "expan", "buyback", "dividend", "bullish", "profit up", "outperform", "strong", "boost", "high"];
const NEGATIVE = ["fall", "drop", "slump", "slip", "loss", "miss", "downgrade", "probe", "fraud", "penalty", "cut", "weak", "plunge", "resign", "default", "bearish", "sell-off", "selloff", "decline", "fine", "lawsuit", "tumble", "crash", "low", "concern", "warn"];

export function sentimentOf(headline: string): NewsItem["sentiment"] {
  const h = headline.toLowerCase();
  const score = POSITIVE.filter((w) => h.includes(w)).length - NEGATIVE.filter((w) => h.includes(w)).length;
  return score > 0 ? "positive" : score < 0 ? "negative" : "neutral";
}

// ---------- demo ----------
const GOOD = ["wins a large new order", "reports stronger quarterly profit", "gets a broker upgrade", "announces capacity expansion", "sees record monthly volumes", "board to consider a buyback"];
const BAD = ["misses quarterly profit estimates", "gets a broker downgrade", "faces a regulatory query", "flags weak demand", "sees margin pressure from higher costs"];

/** Fictional sample headlines, tied to the demo price moves so the story is consistent. */
export function demoNews(snaps: Record<string, Snapshot>, seed: number): NewsBrief {
  const entries = Object.entries(snaps);
  const pick = (sym: string, list: string[]) => list[(sym.charCodeAt(0) + sym.length * 7 + seed) % list.length];
  const ranked = [...entries].sort((a, b) => (b[1].ret1d + b[1].ret5d / 3) - (a[1].ret1d + a[1].ret5d / 3));
  const nGood = Math.min(6, Math.max(2, Math.round(entries.length / 9)));
  const nBad = Math.min(4, Math.max(1, Math.round(entries.length / 14)));
  const items: NewsItem[] = [
    ...ranked.slice(0, nGood).map(([s]) => ({ symbol: s, headline: `${s} ${pick(s, GOOD)}`, sentiment: "positive" as const })),
    ...ranked.slice(-nBad).map(([s]) => ({ symbol: s, headline: `${s} ${pick(s, BAD)}`, sentiment: "negative" as const })),
  ].map((i) => ({ ...i, source: "Sample newswire", sample: true }));
  return { label: "Sample headlines (demo, fictional)", sample: true, total: items.length + entries.length, items };
}

// ---------- Google News RSS ----------
const QUERIES = ["Nifty 50 stocks today", "NSE stocks to watch", "Indian stock market shares news", "stocks in news India"];

function parseRss(xml: string) {
  const out: { title: string; link: string; source: string; date: string }[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const tag = (t: string) => (m[1].match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? "")
      .replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();
    const source = tag("source");
    out.push({ title: tag("title").replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), ""), link: tag("link"), source: source || "Google News", date: tag("pubDate") });
  }
  return out;
}

async function googleNews(symbols: string[]): Promise<NewsBrief> {
  const feeds = await Promise.allSettled(QUERIES.map(async (q) => {
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:1d")}&hl=en-IN&gl=IN&ceid=IN:en`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseRss(await res.text());
  }));
  const all = feeds.flatMap((f) => (f.status === "fulfilled" ? f.value : []));
  if (!all.length) throw new Error("no headlines");
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const a of all) {
    if (seen.has(a.title)) continue;
    seen.add(a.title);
    const sentiment = sentimentOf(a.title);
    if (sentiment === "neutral") continue;
    for (const sym of symbols) {
      const names = [...(COMPANY_NAMES[sym] ?? []), sym];
      if (names.some((n) => new RegExp(`(^|[^A-Za-z])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z]|$)`, "i").test(a.title))) {
        items.push({ symbol: sym, headline: a.title.slice(0, 160), source: a.source, url: a.link, publishedAt: a.date, sentiment, sample: false });
      }
    }
  }
  return { label: "Google News", sample: false, total: seen.size, items };
}

/** Collect news. Returns null when no provider is configured or it cannot be reached. */
export async function loadNews(symbols: string[], demo: boolean, snaps: Record<string, Snapshot>, seed = 0): Promise<NewsBrief | null> {
  if (demo) return demoNews(snaps, seed);
  if ((process.env.NEWS_PROVIDER ?? "google").toLowerCase() !== "google") return null;
  try {
    return await googleNews(symbols);
  } catch (e) {
    console.warn("[nse-agent-desk] news unavailable:", (e as Error).message);
    return null;
  }
}
