/**
 * Balance sheet, cash flow and shareholding for one company, plus key ratios
 * for its peers.
 *  - demo:  sample figures, consistent with the demo market cap and EPS, labelled as samples
 *  - live:  Yahoo Finance fundamentals (annual statements) and holders (unofficial)
 *
 * Shareholding: India's official promoter / FII / DII split is published by
 * NSE and BSE each quarter. Their sites don't allow automated access, so live
 * mode shows what Yahoo provides (insiders vs institutions, top institutional
 * holders) and links to the official NSE page.
 */
import { demoFundamentals } from "../fundamentals";
import { sectorOf } from "../market/universe";
import { yahooSymbol, yahooTimeseries } from "../market/yahoo-timeseries";
import { gradeQuality } from "./quality";
import type { CompanyReport, PeerRow, Shareholding, YearFinancials } from "./types";

const CR = 1e7; // ₹ per crore
const links = (s: string) => [
  { label: "NSE quote & shareholding", url: `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(s)}` },
  { label: "BSE / annual reports (search)", url: `https://www.bseindia.com/` },
];

// ---------- demo ----------
function seeded(str: string) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoFinancials(symbol: string, price: number, seed: number): YearFinancials[] {
  const f = demoFundamentals(symbol, price, seed);
  const r = seeded(`fin:${symbol}:${seed}`);
  const bank = ["Banks", "Financials"].includes(sectorOf(symbol));
  const shares = ((f.marketCapCr ?? 1000) * CR) / price;
  const roe = 0.08 + r() * 0.2, margin = bank ? 0.15 + r() * 0.15 : 0.05 + r() * 0.2;
  const de = bank ? 5 + r() * 5 : r() < 0.25 ? 1.2 + r() * 1.2 : r() * 0.9;
  const conv = r() < 0.2 ? 0.4 + r() * 0.35 : 0.85 + r() * 0.5; // a few companies with poor cash conversion
  const capexShare = 0.3 + r() * 0.75;
  return f.epsHistory.map((h, i) => {
    const ni = (h.eps * shares) / CR;
    const m = margin * (1 + (r() - 0.5) * 0.3);
    const equity = Math.abs(ni) / roe * (0.85 + 0.05 * i);
    const debt = equity * de * (0.85 + r() * 0.3);
    const cfo = bank ? ni * (0.6 + r() * 1.2) : ni * (conv + (r() - 0.5) * 0.3);
    const capex = Math.abs(cfo) * capexShare * (0.8 + r() * 0.4);
    const ca = (equity + debt) * (bank ? 0.3 : 0.35 + r() * 0.2);
    const q = (n: number) => Math.round(n);
    return {
      year: h.period, revenue: q(Math.abs(ni) / m), netIncome: q(ni), equity: q(equity), debt: q(debt),
      totalAssets: q(equity + debt + equity * 0.4), totalLiabilities: q(debt + equity * 0.4),
      cash: q(equity * (0.05 + r() * 0.25)), currentAssets: q(ca), currentLiabilities: q(ca / (bank ? 1 : 0.8 + r() * 0.9)),
      operatingCashFlow: q(cfo), capex: q(capex), freeCashFlow: q(cfo - capex),
      ebit: q(Math.max(ni, 0) * 1.35 + debt * 0.08), interestExpense: q(debt * 0.08),
    };
  });
}

export function demoShareholding(symbol: string, seed: number): Shareholding {
  const r = seeded(`sh:${symbol}:${seed}`);
  const promoters = r() < 0.15 ? 0 : 30 + r() * 45; // some companies have no promoter (professionally run)
  const fii = 8 + r() * 22, dii = 6 + r() * 18;
  const pub = Math.max(5, 100 - promoters - fii - dii - 2);
  const others = Math.max(0, 100 - promoters - fii - dii - pub);
  const round = (n: number) => Math.round(n * 100) / 100;
  const trendStart = promoters + (r() - 0.5) * 3;
  return {
    categories: [
      { label: "Promoters", pct: round(promoters) }, { label: "FIIs (foreign institutions)", pct: round(fii) },
      { label: "DIIs (mutual funds, insurers)", pct: round(dii) }, { label: "Public & retail", pct: round(pub) }, { label: "Others", pct: round(others) },
    ],
    top: [
      ...(promoters ? [{ name: "Promoter group", type: "Promoter", pct: round(promoters * 0.8) }] : []),
      { name: "Foreign institution 1", type: "FII", pct: round(fii * 0.25) },
      { name: "Domestic mutual fund 1", type: "DII", pct: round(dii * 0.3) },
      { name: "Insurance company 1", type: "DII", pct: round(dii * 0.2) },
      { name: "Foreign institution 2", type: "FII", pct: round(fii * 0.15) },
    ],
    promoterTrend: promoters ? ["Q4", "Q1", "Q2", "Q3"].map((q, i) => ({ period: q, pct: round(trendStart + ((promoters - trendStart) * i) / 3) })) : undefined,
    pledgedPct: promoters ? round(r() < 0.75 ? 0 : r() * 15) : undefined,
    source: "Sample figures (demo)", sample: true,
    note: "Holder names are generic placeholders in demo mode.",
  };
}

// ---------- live ----------
const ANNUAL = ["TotalRevenue", "NetIncome", "TotalAssets", "TotalLiabilitiesNetMinorityInterest", "StockholdersEquity", "TotalDebt",
  "CashAndCashEquivalents", "CurrentAssets", "CurrentLiabilities", "OperatingCashFlow", "CapitalExpenditure", "FreeCashFlow", "EBIT", "InterestExpense"];

async function yahooFinancials(symbol: string): Promise<YearFinancials[]> {
  const s = await yahooTimeseries(symbol, ANNUAL.map((t) => `annual${t}`));
  const dates = [...new Set(Object.values(s).flat().map((p) => p.date))].sort().slice(-4);
  const at = (t: string, d: string) => {
    const v = s[`annual${t}`]?.find((p) => p.date === d)?.v;
    return v === undefined ? undefined : Math.round(v / CR);
  };
  return dates.map((d) => {
    const capex = at("CapitalExpenditure", d);
    // Indian fiscal year ends in March: a March 2025 statement is FY25.
    const yr = Number(d.slice(2, 4)) + (Number(d.slice(5, 7)) > 3 ? 1 : 0);
    return {
      year: `FY${String(yr).padStart(2, "0")}`, revenue: at("TotalRevenue", d), netIncome: at("NetIncome", d), totalAssets: at("TotalAssets", d),
      totalLiabilities: at("TotalLiabilitiesNetMinorityInterest", d), equity: at("StockholdersEquity", d), debt: at("TotalDebt", d),
      cash: at("CashAndCashEquivalents", d), currentAssets: at("CurrentAssets", d), currentLiabilities: at("CurrentLiabilities", d),
      operatingCashFlow: at("OperatingCashFlow", d), capex: capex === undefined ? undefined : Math.abs(capex),
      freeCashFlow: at("FreeCashFlow", d), ebit: at("EBIT", d), interestExpense: at("InterestExpense", d),
    };
  });
}

/** Yahoo's quoteSummary needs a session cookie and "crumb". */
let crumb: { cookie: string; crumb: string; at: number } | null = null;
async function yahooCrumb() {
  if (crumb && Date.now() - crumb.at < 3600_000) return crumb;
  const r1 = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "manual", signal: AbortSignal.timeout(10000) });
  const cookie = (r1.headers.get("set-cookie") ?? "").split(";")[0];
  const r2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { "User-Agent": "Mozilla/5.0", cookie }, signal: AbortSignal.timeout(10000) });
  if (!r2.ok) throw new Error(`crumb HTTP ${r2.status}`);
  crumb = { cookie, crumb: (await r2.text()).trim(), at: Date.now() };
  return crumb;
}

async function yahooShareholding(symbol: string): Promise<Shareholding> {
  const c = await yahooCrumb();
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol(symbol))}` +
    `?modules=majorHoldersBreakdown,institutionOwnership,fundOwnership&crumb=${encodeURIComponent(c.crumb)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", cookie: c.cookie }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const q = (await res.json())?.quoteSummary?.result?.[0];
  if (!q) throw new Error("no holders data");
  const pct = (v?: { raw?: number }) => (v?.raw === undefined ? undefined : Math.round(v.raw * 10000) / 100);
  const ins = pct(q.majorHoldersBreakdown?.insidersPercentHeld), inst = pct(q.majorHoldersBreakdown?.institutionsPercentHeld);
  const categories = [
    ...(ins !== undefined ? [{ label: "Insiders (mostly promoters)", pct: ins }] : []),
    ...(inst !== undefined ? [{ label: "Institutions (FIIs + DIIs)", pct: inst }] : []),
  ];
  if (categories.length) categories.push({ label: "Public & others", pct: Math.max(0, Math.round((100 - (ins ?? 0) - (inst ?? 0)) * 100) / 100) });
  type Own = { organization?: string; pctHeld?: { raw?: number }; reportDate?: { fmt?: string } };
  const list = (rows: Own[] | undefined, type: string) => (rows ?? []).map((o) => ({ name: o.organization ?? "Unknown", type, pct: pct(o.pctHeld) ?? 0 }));
  const top = [...list(q.institutionOwnership?.ownershipList, "Institution"), ...list(q.fundOwnership?.ownershipList, "Fund")]
    .sort((a, b) => b.pct - a.pct).slice(0, 8);
  return {
    categories, top, asOf: q.institutionOwnership?.ownershipList?.[0]?.reportDate?.fmt, source: "Yahoo Finance (unofficial)", sample: false,
    note: "Yahoo groups foreign and domestic institutions together and doesn't show the official promoter split or pledges. Check the NSE shareholding page for those.",
  };
}

const cache = new Map<string, { at: number; v: unknown }>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.v as T;
  const v = await fn();
  cache.set(key, { at: Date.now(), v });
  return v;
}

/** Analysts' mean 12-month price target (live only). */
export async function yahooAnalystTarget(symbol: string): Promise<{ mean: number; analysts: number } | null> {
  return cached(`tgt:${symbol}`, async () => {
    const c = await yahooCrumb();
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol(symbol))}?modules=financialData&crumb=${encodeURIComponent(c.crumb)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", cookie: c.cookie }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const fd = (await res.json())?.quoteSummary?.result?.[0]?.financialData;
    const mean = fd?.targetMeanPrice?.raw, analysts = fd?.numberOfAnalystOpinions?.raw ?? 0;
    return typeof mean === "number" && mean > 0 && analysts > 0 ? { mean, analysts } : null;
  }).catch(() => null);
}

/** Annual financials for several companies (demo or live). Missing companies get []. */
export async function loadFinancials(prices: Record<string, number>, opts: { demo: boolean; seed: number }): Promise<Record<string, YearFinancials[]>> {
  const out: Record<string, YearFinancials[]> = {};
  const queue = Object.keys(prices);
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      out[s] = opts.demo ? demoFinancials(s, prices[s], opts.seed)
        : await cached(`fin:${s}`, () => yahooFinancials(s)).catch(() => [] as YearFinancials[]);
    }
  }));
  return out;
}

// ---------- public ----------

export async function companyReport(symbol: string, opts: { demo: boolean; price: number; seed: number }): Promise<CompanyReport> {
  const sector = sectorOf(symbol);
  if (opts.demo) {
    const years = demoFinancials(symbol, opts.price, opts.seed);
    const { ratios, quality } = gradeQuality(years, sector);
    return { symbol, sector, years, ratios, quality, shareholding: demoShareholding(symbol, opts.seed), source: "Sample figures (demo)", sample: true, links: links(symbol) };
  }
  const [years, shareholding] = await Promise.all([
    cached(`fin:${symbol}`, () => yahooFinancials(symbol)).catch(() => [] as YearFinancials[]),
    cached(`sh:${symbol}`, () => yahooShareholding(symbol)).catch(() => null),
  ]);
  const { ratios, quality } = gradeQuality(years, sector);
  return { symbol, sector, years, ratios, quality, shareholding, source: "Yahoo Finance (unofficial)", sample: false, links: links(symbol) };
}

export async function peerRows(peers: { symbol: string; price: number }[], opts: { demo: boolean; seed: number }): Promise<PeerRow[]> {
  return Promise.all(peers.map(async (p) => {
    const years = opts.demo ? demoFinancials(p.symbol, p.price, opts.seed)
      : await cached(`fin:${p.symbol}`, () => yahooFinancials(p.symbol)).catch(() => [] as YearFinancials[]);
    const { ratios, quality } = gradeQuality(years, sectorOf(p.symbol));
    return { symbol: p.symbol, ratios, grade: quality.grade };
  }));
}
