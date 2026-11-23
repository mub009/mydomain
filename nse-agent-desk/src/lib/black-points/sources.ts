/**
 * Evidence sources for the Black Points Analyst.
 *
 *  Primary (can verify a finding)
 *   - SEBI enforcement orders: the newest pages of the public orders lists
 *     (Chairperson/Members, adjudication, settlement), matched by company name
 *   - Exchange filings you supply in .data/filings.json (NSE/BSE announcements;
 *     both exchanges block automated access, so they are not fetched)
 *   - Company financial statements (annual reports, via Yahoo Finance)
 *   - Company calendar (results and ex-dividend dates, via Yahoo Finance)
 *  Secondary (cannot verify on its own)
 *   - Google News headlines from the last 180 days
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { quoteSummary } from "../company";
import { parseRss } from "../news";

export interface SebiOrder { title: string; url: string; date: string }
export interface Filing { symbol: string; date: string; title: string; url?: string; source?: string }
export interface Profile { name?: string; sector?: string; industry?: string; earningsDate?: string; earningsEstimate?: boolean; exDividendDate?: string }
export interface NewsHit { title: string; url: string; date: string; source: string }

const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
const isoOf = (d: Date) => d.toISOString().slice(0, 10);

/** "Limited", "Ltd", "(India)" removed, for matching names in titles and searching news. */
export function cleanName(name: string) {
  return name.replace(/\(india\)/gi, "").replace(/\b(limited|ltd\.?|the|co\.?)\b/gi, "").replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
}

export function parseSebiListing(html: string): SebiOrder[] {
  const out: SebiOrder[] = [];
  for (const m of html.matchAll(/<td>([A-Z][a-z]{2}) (\d{2}), (\d{4})<\/td>\s*<td><a href="(https:\/\/www\.sebi\.gov\.in\/[^"]+)"[^>]*title="([^"]*)"/g)) {
    out.push({ date: `${m[3]}-${MONTHS[m[1]] ?? "01"}-${m[2]}`, url: m[4], title: m[5].replace(/&amp;/g, "&").trim() });
  }
  return out;
}

let sebiCache: { at: number; v: { orders: SebiOrder[]; ok: boolean; from?: string } } | null = null;
/** Newest SEBI orders: Chairperson/Members (2), adjudication (6), settlement (3). */
export async function loadSebiOrders(): Promise<{ orders: SebiOrder[]; ok: boolean; from?: string }> {
  if (sebiCache && Date.now() - sebiCache.at < 6 * 3600_000) return sebiCache.v;
  const pages = await Promise.allSettled([2, 6, 3].map(async (smid) => {
    const res = await fetch(`https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=2&ssid=9&smid=${smid}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseSebiListing(await res.text());
  }));
  const orders = pages.flatMap((p) => (p.status === "fulfilled" ? p.value : []));
  const v = { orders, ok: orders.length > 0, from: orders.length ? orders.map((o) => o.date).sort()[0] : undefined };
  sebiCache = { at: Date.now(), v };
  return v;
}

/** Your own copy of NSE/BSE announcements: [{ symbol, date, title, url }] in .data/filings.json. */
export async function loadFilingsFile(): Promise<{ filings: Filing[]; ok: boolean }> {
  try {
    const f = JSON.parse(await readFile(path.join(process.env.NSE_DESK_DATA_DIR ?? path.join(process.cwd(), ".data"), "filings.json"), "utf8"));
    const list: Filing[] = (Array.isArray(f) ? f : f.filings ?? []).filter((x: Filing) => x?.symbol && x?.title && x?.date)
      .map((x: Filing) => ({ ...x, symbol: String(x.symbol).toUpperCase() }));
    return { filings: list, ok: true };
  } catch { return { filings: [], ok: false }; }
}

export async function loadProfile(symbol: string): Promise<Profile | null> {
  try {
    const q = await quoteSummary(symbol, "assetProfile,calendarEvents,price");
    const ap = q?.assetProfile ?? {}, ce = q?.calendarEvents ?? {};
    const raw = (x?: { raw?: number }) => (typeof x?.raw === "number" ? isoOf(new Date(x.raw * 1000)) : undefined);
    return {
      name: q?.price?.longName ?? q?.price?.shortName, sector: ap.sector, industry: ap.industry,
      earningsDate: raw(ce.earnings?.earningsDate?.[0]), earningsEstimate: Boolean(ce.earnings?.isEarningsDateEstimate),
      exDividendDate: raw(ce.exDividendDate),
    };
  } catch { return null; }
}

/** Headlines naming the company in the last 180 days (null when Google News can't be reached). */
export async function stockNews(name: string, symbol: string): Promise<NewsHit[] | null> {
  const q = `"${cleanName(name)}" when:180d`;
  try {
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const words = cleanName(name).toLowerCase().split(" ").filter((w) => w.length > 2).slice(0, 2);
    return parseRss(await res.text())
      .filter((a) => words.every((w) => a.title.toLowerCase().includes(w)) || new RegExp(`\\b${symbol.replace(/[^A-Z0-9]/g, "")}\\b`, "i").test(a.title))
      .map((a) => ({ title: a.title, url: a.link, source: a.source, date: a.date ? isoOf(new Date(a.date)) : "" }));
  } catch { return null; }
}

/** Run fn over items with at most n in flight. */
export async function inBatches<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i]);
  }));
  return out;
}
