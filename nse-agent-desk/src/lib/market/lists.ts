/**
 * Big stock lists, downloaded from NSE's own files and kept for a day:
 * - Nifty 500: the official index list (with each company's industry).
 * - All NSE: every share in NSE's main (EQ) series, about 2,000+ companies.
 * If NSE can't be reached, the built-in 110 stocks are used instead and the run says so.
 */
import { ALL_CAPS, sectorOf } from "./universe";

export type BigUniverse = "nifty500" | "allnse";
export const BIG_UNIVERSES: Record<BigUniverse, { label: string; about: string }> = {
  nifty500: { label: "Nifty 500", about: "about 500" },
  allnse: { label: "All NSE stocks", about: "about 2,000" },
};
export const isBigUniverse = (u: unknown): u is BigUniverse => u === "nifty500" || u === "allnse";

export interface StockList {
  id: BigUniverse;
  label: string;
  symbols: string[];
  /** Sector for each symbol, where NSE gives the company's industry. */
  sectors: Record<string, string>;
  /** "nse" when the list came from NSE, "built-in" when NSE couldn't be reached. */
  from: "nse" | "built-in";
  note?: string;
}

const INDEX_FILES = (file: string) => [
  `https://www.niftyindices.com/IndexConstituent/${file}`,
  `https://nsearchives.nseindia.com/content/indices/${file}`,
];
const EQUITY_FILES = [
  "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv",
  "https://archives.nseindia.com/content/equities/EQUITY_L.csv",
];

/** NSE's industry names, mapped to the desk's sector names. */
const INDUSTRY: [RegExp, string][] = [
  [/information technology/i, "IT"],
  [/healthcare|pharma/i, "Pharma"],
  [/fast moving|fmcg/i, "FMCG"],
  [/automobile/i, "Auto"],
  [/oil|gas|consumable fuels/i, "Energy"],
  [/power/i, "Utilities"],
  [/metals|mining/i, "Metals"],
  [/construction materials|cement/i, "Cement"],
  [/^construction$/i, "Infrastructure"],
  [/capital goods/i, "Capital Goods"],
  [/chemicals/i, "Chemicals"],
  [/realty/i, "Realty"],
  [/consumer durables|consumer services/i, "Consumer"],
  [/telecom/i, "Telecom"],
  [/textiles/i, "Textiles"],
  [/media|entertainment/i, "Media"],
  [/services/i, "Services"],
  [/diversified/i, "Conglomerate"],
  [/forest/i, "Building Materials"],
];

/** A desk sector from NSE's industry name; banks are split out of Financial Services by name. */
export function sectorFromIndustry(industry: string, company = ""): string {
  const ind = industry.trim();
  if (/financial services/i.test(ind)) return /\bbank\b/i.test(company) && !/finance|housing/i.test(company) ? "Banks" : "Financials";
  for (const [re, s] of INDUSTRY) if (re.test(ind)) return s;
  const clean = ind.replace(/[^A-Za-z &]/g, "").trim().slice(0, 30);
  return clean.length >= 2 ? clean : "Other";
}

/** Splits one CSV line, allowing quoted fields with commas. */
function cells(line: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Rows of a CSV as objects keyed by upper-case header. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const head = cells(lines[0]).map((h) => h.toUpperCase());
  return lines.slice(1).map((l) => { const c = cells(l); return Object.fromEntries(head.map((h, i) => [h, c[i] ?? ""])); });
}

const SYMBOL = /^[A-Z0-9&\-]{1,20}$/;

/** An NSE index list (Company Name, Industry, Symbol, Series, ISIN Code). */
export function parseIndexCsv(text: string): { symbols: string[]; sectors: Record<string, string> } {
  const symbols: string[] = []; const sectors: Record<string, string> = {};
  for (const r of parseCsv(text)) {
    const s = (r["SYMBOL"] ?? "").toUpperCase();
    if (!SYMBOL.test(s) || (r["SERIES"] && r["SERIES"] !== "EQ")) continue;
    symbols.push(s);
    if (r["INDUSTRY"]) sectors[s] = sectorFromIndustry(r["INDUSTRY"], r["COMPANY NAME"]);
  }
  return { symbols: [...new Set(symbols)], sectors };
}

/** NSE's list of every listed share (SYMBOL, NAME OF COMPANY, SERIES, ...): main-board EQ series only. */
export function parseEquityCsv(text: string): string[] {
  const out = parseCsv(text).filter((r) => r["SERIES"] === "EQ").map((r) => (r["SYMBOL"] ?? "").toUpperCase()).filter((s) => SYMBOL.test(s));
  return [...new Set(out)];
}

async function firstText(urls: string[]): Promise<string> {
  let last: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NSE Agent Desk)", Accept: "text/csv,text/plain,*/*" },
        cache: "no-store", signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!/symbol/i.test(text.slice(0, 300))) throw new Error("not a stock list");
      return text;
    } catch (e) { last = e; }
  }
  throw last instanceof Error ? last : new Error("download failed");
}

const DAY = 24 * 60 * 60 * 1000;
const cache = new Map<BigUniverse, { at: number; list: StockList }>();

function builtIn(id: BigUniverse, why: string): StockList {
  return {
    id, label: BIG_UNIVERSES[id].label, symbols: ALL_CAPS,
    sectors: Object.fromEntries(ALL_CAPS.map((s) => [s, sectorOf(s)])), from: "built-in",
    note: `NSE's stock list couldn't be downloaded (${why}), so the built-in ${ALL_CAPS.length} stocks were used.`,
  };
}

/** The Nifty 500 or the full NSE list; cached for a day, built-in stocks if NSE can't be reached. */
export async function loadStockList(id: BigUniverse): Promise<StockList> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < DAY) return hit.list;
  let list: StockList;
  try {
    if (id === "nifty500") {
      const { symbols, sectors } = parseIndexCsv(await firstText(INDEX_FILES("ind_nifty500list.csv")));
      if (symbols.length < 300) throw new Error(`only ${symbols.length} stocks`);
      list = { id, label: BIG_UNIVERSES[id].label, symbols, sectors, from: "nse" };
    } else {
      // The full list has no industries, so take them from the Nifty Total Market (~750) list where we can.
      const [all, total] = await Promise.allSettled([firstText(EQUITY_FILES), firstText(INDEX_FILES("ind_niftytotalmarket_list.csv"))]);
      if (all.status === "rejected") throw all.reason;
      const symbols = parseEquityCsv(all.value);
      if (symbols.length < 1000) throw new Error(`only ${symbols.length} stocks`);
      const sectors = total.status === "fulfilled" ? parseIndexCsv(total.value).sectors : {};
      for (const s of symbols) if (!sectors[s]) { const k = sectorOf(s); if (k !== "Other") sectors[s] = k; }
      list = { id, label: BIG_UNIVERSES[id].label, symbols, sectors, from: "nse" };
    }
  } catch (e) {
    const fallback = builtIn(id, (e as Error).message || "network error");
    cache.set(id, { at: Date.now() - DAY + 10 * 60 * 1000, list: fallback }); // try NSE again in 10 minutes
    return fallback;
  }
  cache.set(id, { at: Date.now(), list });
  return list;
}
