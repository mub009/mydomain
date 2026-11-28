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
import type { CompanyReport, PeerRow, Shareholding, YearFinancials, CompanyProfile } from "./types";

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
const ITEMS = ["TotalRevenue", "NetIncome", "TotalAssets", "TotalLiabilitiesNetMinorityInterest", "StockholdersEquity", "TotalDebt",
  "CashAndCashEquivalents", "CurrentAssets", "CurrentLiabilities", "OperatingCashFlow", "CapitalExpenditure", "FreeCashFlow", "EBIT", "InterestExpense",
  "CostOfRevenue", "GrossProfit", "OperatingExpense", "OperatingIncome", "EBITDA", "PretaxIncome", "TaxProvision", "DilutedEPS", "BasicEPS",
  "InterestIncome", "NetInterestIncome", "NonInterestIncome", "TotalExpenses", "ReconciledDepreciation", "DepreciationAndAmortizationInIncomeStatement", "MinorityInterests",
  "InvestingCashFlow", "FinancingCashFlow", "ChangesInCash", "ChangeInWorkingCapital", "CashDividendsPaid", "IssuanceOfDebt", "RepaymentOfDebt", "EndCashPosition",
  "NetPPE", "Goodwill", "Inventory", "AccountsReceivable", "RetainedEarnings", "NetDebt", "WorkingCapital", "MinorityInterest", "ShareIssued"];

/** Indian fiscal year (April-March) label: a March 2025 statement is FY25; a September 2025 quarter is Q2 FY26. */
export function periodLabel(date: string, period: "annual" | "quarterly"): string {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  const fy = (m > 3 ? y + 1 : y) % 100;
  if (period === "annual") return `FY${String(fy).padStart(2, "0")}`;
  const q = m >= 4 && m <= 6 ? 1 : m >= 7 && m <= 9 ? 2 : m >= 10 ? 3 : 4;
  return `Q${q} FY${String(fy).padStart(2, "0")}`;
}

/** Statements for the last 4 years or ~5 quarters from Yahoo's fundamentals series (exported for tests). */
export function toPeriods(s: Record<string, { date: string; v: number }[]>, period: "annual" | "quarterly", keep: number): YearFinancials[] {
  // Periods come from the income statement when there is one, so half-yearly balance sheets don't add empty columns.
  const income = ["TotalRevenue", "NetIncome", "PretaxIncome"].flatMap((t) => s[`${period}${t}`] ?? []);
  const dates = [...new Set((income.length ? income : Object.values(s).flat()).map((p) => p.date))].sort().slice(-keep);
  const raw = (t: string, d: string) => s[`${period}${t}`]?.find((p) => p.date === d)?.v;
  // ₹ crore to two decimals (no rounding to whole crores).
  const at = (t: string, d: string) => { const v = raw(t, d); return v === undefined ? undefined : Math.round((v / CR) * 100) / 100; };
  const abs = (x?: number) => (x === undefined ? undefined : Math.abs(x));
  return dates.map((d) => {
    const capex = at("CapitalExpenditure", d);
    const eps = raw("DilutedEPS", d) ?? raw("BasicEPS", d);
    return {
      year: periodLabel(d, period), date: d, revenue: at("TotalRevenue", d), netIncome: at("NetIncome", d), totalAssets: at("TotalAssets", d),
      totalLiabilities: at("TotalLiabilitiesNetMinorityInterest", d), equity: at("StockholdersEquity", d), debt: at("TotalDebt", d),
      cash: at("CashAndCashEquivalents", d), currentAssets: at("CurrentAssets", d), currentLiabilities: at("CurrentLiabilities", d),
      operatingCashFlow: at("OperatingCashFlow", d), capex: capex === undefined ? undefined : Math.abs(capex),
      freeCashFlow: at("FreeCashFlow", d), ebit: at("EBIT", d), interestExpense: at("InterestExpense", d),
      costOfRevenue: at("CostOfRevenue", d), grossProfit: at("GrossProfit", d), operatingExpense: at("OperatingExpense", d),
      operatingIncome: at("OperatingIncome", d), ebitda: at("EBITDA", d), pretaxIncome: at("PretaxIncome", d), tax: at("TaxProvision", d),
      eps: eps === undefined ? undefined : Math.round(eps * 100) / 100,
      interestIncome: at("InterestIncome", d), netInterestIncome: at("NetInterestIncome", d), otherIncome: at("NonInterestIncome", d),
      totalExpenses: at("TotalExpenses", d), depreciation: at("ReconciledDepreciation", d) ?? at("DepreciationAndAmortizationInIncomeStatement", d),
      minorityInterests: at("MinorityInterests", d),
      investingCashFlow: at("InvestingCashFlow", d), financingCashFlow: at("FinancingCashFlow", d), netChangeInCash: at("ChangesInCash", d),
      changeInWorkingCapital: at("ChangeInWorkingCapital", d), dividendsPaid: abs(at("CashDividendsPaid", d)), debtIssued: at("IssuanceOfDebt", d),
      debtRepaid: abs(at("RepaymentOfDebt", d)), endCash: at("EndCashPosition", d),
      netPPE: at("NetPPE", d), goodwill: at("Goodwill", d), inventory: at("Inventory", d), receivables: at("AccountsReceivable", d),
      retainedEarnings: at("RetainedEarnings", d), netDebt: at("NetDebt", d), workingCapital: at("WorkingCapital", d),
      minorityInterest: at("MinorityInterest", d), shares: at("ShareIssued", d),
    };
  });
}

async function yahooFinancials(symbol: string): Promise<YearFinancials[]> {
  return toPeriods(await yahooTimeseries(symbol, ITEMS.map((t) => `annual${t}`)), "annual", 4);
}

async function yahooQuarters(symbol: string): Promise<YearFinancials[]> {
  return toPeriods(await yahooTimeseries(symbol, ITEMS.map((t) => `quarterly${t}`), 2), "quarterly", 5);
}

/** Yahoo's quoteSummary needs a session cookie and "crumb". */
let crumb: { cookie: string; crumb: string; at: number } | null = null;
let crumbPending: Promise<{ cookie: string; crumb: string; at: number }> | null = null;
/** One shared session for all requests (parallel callers wait for the same one). */
function yahooCrumb(fresh = false) {
  if (fresh) crumb = null;
  if (crumb && Date.now() - crumb.at < 3600_000) return Promise.resolve(crumb);
  crumbPending ??= newCrumb().finally(() => { crumbPending = null; });
  return crumbPending;
}

async function newCrumb() {
  const r1 = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "manual", signal: AbortSignal.timeout(10000) });
  const cookie = (r1.headers.get("set-cookie") ?? "").split(";")[0];
  const r2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { "User-Agent": "Mozilla/5.0", cookie }, signal: AbortSignal.timeout(10000) });
  if (!r2.ok) throw new Error(`crumb HTTP ${r2.status}`);
  crumb = { cookie, crumb: (await r2.text()).trim(), at: Date.now() };
  return crumb;
}

/** Yahoo quoteSummary with the shared session; retries once with a fresh session if it was rejected. */
/** Yahoo quoteSummary. NSE symbols get ".NS" added; pass `raw` for any other Yahoo symbol (AAPL, 7203.T). */
export async function quoteSummary(symbol: string, modules: string, raw = false) {
  for (const fresh of [false, true]) {
    const c = await yahooCrumb(fresh);
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(raw ? symbol : yahooSymbol(symbol))}?modules=${modules}&crumb=${encodeURIComponent(c.crumb)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", cookie: c.cookie }, signal: AbortSignal.timeout(10000) });
    if (res.ok) return (await res.json())?.quoteSummary?.result?.[0];
    if (res.status !== 401 && res.status !== 403) throw new Error(`HTTP ${res.status}`);
  }
  throw new Error("Yahoo session rejected");
}

/** What the company does and its key numbers, from Yahoo's company profile. */
export async function yahooProfile(symbol: string): Promise<CompanyProfile | null> {
  const q = await quoteSummary(symbol, "assetProfile,summaryDetail,defaultKeyStatistics,price,financialData");
  if (!q) return null;
  const ap = q.assetProfile ?? {}, sd = q.summaryDetail ?? {}, ks = q.defaultKeyStatistics ?? {}, fd = q.financialData ?? {}, pr = q.price ?? {};
  const n = (v?: { raw?: number }) => (typeof v?.raw === "number" && Number.isFinite(v.raw) ? v.raw : undefined);
  const r2 = (v?: number) => (v === undefined ? undefined : Math.round(v * 100) / 100);
  const pctOf = (v?: number) => (v === undefined ? undefined : Math.round(v * 10000) / 100);
  const mcap = n(sd.marketCap) ?? n(pr.marketCap);
  const de = n(fd.debtToEquity);
  return {
    name: pr.longName ?? pr.shortName, sector: ap.sector, industry: ap.industry,
    about: typeof ap.longBusinessSummary === "string" ? ap.longBusinessSummary.trim() : undefined,
    website: typeof ap.website === "string" && /^https?:\/\//.test(ap.website) ? ap.website : undefined,
    city: [ap.city, ap.country].filter(Boolean).join(", ") || undefined, employees: ap.fullTimeEmployees,
    people: ((ap.companyOfficers ?? []) as { name?: string; title?: string }[]).filter((o) => o.name).slice(0, 4).map((o) => ({ name: o.name!.replace(/\s+/g, " "), title: o.title ?? "" })),
    stats: {
      marketCapCr: mcap === undefined ? undefined : Math.round(mcap / CR), pe: r2(n(sd.trailingPE)), forwardPe: r2(n(sd.forwardPE)), pb: r2(n(ks.priceToBook)),
      eps: r2(n(ks.trailingEps)), bookValue: r2(n(ks.bookValue)), dividendYield: pctOf(n(sd.dividendYield)), beta: r2(n(sd.beta) ?? n(ks.beta)),
      high52: r2(n(sd.fiftyTwoWeekHigh)), low52: r2(n(sd.fiftyTwoWeekLow)), avgVolume: n(sd.averageVolume),
      roe: pctOf(n(fd.returnOnEquity)), profitMargin: pctOf(n(fd.profitMargins)), revenueGrowth: pctOf(n(fd.revenueGrowth)), earningsGrowth: pctOf(n(fd.earningsGrowth)),
      // Yahoo gives debt/equity as a percentage (44.3 = 0.44).
      debtToEquity: de === undefined ? undefined : Math.round(de) / 100,
    },
    source: "Yahoo Finance (unofficial)",
  };
}

async function yahooShareholding(symbol: string): Promise<Shareholding> {
  const q = await quoteSummary(symbol, "majorHoldersBreakdown,institutionOwnership,fundOwnership");
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
    const fd = (await quoteSummary(symbol, "financialData"))?.financialData;
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
    return { symbol, sector, years, quarters: [], ratios, quality, shareholding: demoShareholding(symbol, opts.seed), source: "Sample figures (demo)", sample: true, links: links(symbol) };
  }
  const [years, quarters, shareholding, profile] = await Promise.all([
    cached(`fin:${symbol}`, () => yahooFinancials(symbol)).catch(() => [] as YearFinancials[]),
    cached(`finq:${symbol}`, () => yahooQuarters(symbol)).catch(() => [] as YearFinancials[]),
    cached(`sh:${symbol}`, () => yahooShareholding(symbol)).catch(() => null),
    cached(`prof:${symbol}`, () => yahooProfile(symbol)).catch(() => null),
  ]);
  const { ratios, quality } = gradeQuality(years, sector);
  return { symbol, sector, years, quarters, ratios, quality, shareholding, profile, source: "Yahoo Finance (unofficial)", sample: false, links: links(symbol) };
}

export async function peerRows(peers: { symbol: string; price: number }[], opts: { demo: boolean; seed: number }): Promise<PeerRow[]> {
  return Promise.all(peers.map(async (p) => {
    const years = opts.demo ? demoFinancials(p.symbol, p.price, opts.seed)
      : await cached(`fin:${p.symbol}`, () => yahooFinancials(p.symbol)).catch(() => [] as YearFinancials[]);
    const { ratios, quality } = gradeQuality(years, sectorOf(p.symbol));
    return { symbol: p.symbol, ratios, grade: quality.grade };
  }));
}
