/** Black Points Analyst: gathers the evidence and investigates every stock that passed a scan. */
import { demoFinancials, loadFinancials } from "../company";
import type { YearFinancials } from "../company/types";
import { COMPANY_NAMES } from "../news";
import type { Analysis, Bar, BPReport, BPSummary } from "../types";
import { type BPContext, investigate, passedScan, peerStats, RULES, type StockEvidence } from "./analyst";
import { cleanName, type Filing, inBatches, loadFilingsFile, loadProfile, loadSebiOrders, type NewsHit, type Profile, stockNews } from "./sources";

export { passedScan, PERIOD_LABEL, WINDOW_DAYS } from "./analyst";

function seeded(str: string) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Sample cases for demo mode: a few headline-only flags and one confirmed filing, all labelled as samples. */
function demoEvidence(symbol: string, seed: number, today: string): { news: NewsHit[]; filings: Filing[] } {
  const r = seeded(`bp:${symbol}:${seed}`);
  const name = COMPANY_NAMES[symbol]?.[0] ?? symbol;
  const x = r();
  const date = new Date(Date.parse(today) - Math.floor(r() * 60) * 86400_000).toISOString().slice(0, 10);
  if (x < 0.05) return { news: [], filings: [{ symbol, date, title: `${name}: intimation of resignation of statutory auditor (sample)`, source: "Sample exchange filing (demo)" }] };
  if (x < 0.12) return { news: [{ title: `${name} faces delay in loan repayment, lenders say (sample headline)`, url: "", date, source: "Sample news (demo)" }], filings: [] };
  if (x < 0.18) return { news: [{ title: `${name} loses key contract with major client (sample headline)`, url: "", date, source: "Sample news (demo)" }], filings: [] };
  return { news: [], filings: [] };
}

export async function runBlackPoints(rows: Analysis[], o: {
  demo: boolean; seed: number; frames: Record<string, Bar[]>; sectorOf: (s: string) => string;
  sectors: { sector: string; state: string; ret3m: number; sourceLabel?: string }[];
}): Promise<{ reports: Record<string, BPReport>; summary: BPSummary }> {
  const candidates = rows.filter(passedScan);
  const anyBars = Object.values(o.frames)[0];
  const today = anyBars?.[anyBars.length - 1]?.date ?? new Date().toISOString().slice(0, 10);
  const strict = process.env.BLACK_POINTS_STRICT === "1";
  const price = (s: string) => o.frames[s][o.frames[s].length - 1].close;
  // financials for the candidates and their sector peers in this run
  const sectorsNeeded = new Set(candidates.map((r) => o.sectorOf(r.symbol)));
  const peerSyms = rows.map((r) => r.symbol).filter((s) => sectorsNeeded.has(o.sectorOf(s)));

  let fin: Record<string, YearFinancials[]>, profiles: (Profile | null)[], news: (NewsHit[] | null)[], filings: Filing[], filingsOk: boolean;
  let sebi: { orders: { title: string; url: string; date: string }[]; ok: boolean; from?: string };
  if (o.demo) {
    fin = Object.fromEntries(peerSyms.map((s) => [s, demoFinancials(s, price(s), o.seed)]));
    profiles = candidates.map(() => null);
    const demo = candidates.map((r) => demoEvidence(r.symbol, o.seed, today));
    news = demo.map((d) => d.news);
    filings = demo.flatMap((d) => d.filings);
    filingsOk = true;
    sebi = { orders: [], ok: true };
  } else {
    const [f, pr, s, fl] = await Promise.all([
      loadFinancials(Object.fromEntries(peerSyms.map((s) => [s, price(s)])), { demo: false, seed: 0 }),
      inBatches(candidates, 4, (r) => loadProfile(r.symbol)),
      loadSebiOrders(),
      loadFilingsFile(),
    ]);
    fin = f; profiles = pr; sebi = s; filings = fl.filings; filingsOk = fl.ok;
    news = await inBatches(candidates, 4, (r) => stockNews(pr[candidates.indexOf(r)]?.name ?? COMPANY_NAMES[r.symbol]?.[0] ?? r.symbol, r.symbol));
  }

  const peers = Object.fromEntries(peerSyms.map((s) => [s, peerStats(fin[s] ?? [])]));
  const sectorRule = RULES.find((x) => x.sector)!;
  const sectorNews: BPContext["sectorNews"] = {};
  candidates.forEach((r, i) => {
    for (const hit of (news[i] ?? []).filter((n) => sectorRule.re.test(n.title))) (sectorNews[o.sectorOf(r.symbol)] ??= []).push({ symbol: r.symbol, hit });
  });
  const ctx: BPContext = { today, sample: o.demo, sebiOk: sebi.ok, filingsOk, strict, sectorOf: o.sectorOf, sectors: o.sectors, peers, sectorNews };
  const yearAgo = new Date(Date.parse(today) - 365 * 86400_000).toISOString().slice(0, 10);

  const reports: Record<string, BPReport> = {};
  candidates.forEach((r, i) => {
    const name = cleanName(profiles[i]?.name ?? COMPANY_NAMES[r.symbol]?.[0] ?? "").toLowerCase();
    const ev: StockEvidence = {
      years: fin[r.symbol] ?? [], profile: profiles[i], news: news[i],
      filings: filings.filter((f) => f.symbol === r.symbol && f.date >= yearAgo),
      // SEBI orders naming the company (names under 6 letters are too ambiguous to match)
      sebi: name.length >= 6 ? sebi.orders.filter((x) => x.date >= yearAgo && x.title.toLowerCase().includes(name)) : [],
    };
    reports[r.symbol] = investigate(r, ev, ctx);
  });

  const coverage = o.demo ? ["Demo mode: financials, headlines and filings are samples."] : [
    "Company financial statements: annual reports via Yahoo Finance.",
    sebi.ok ? `SEBI orders: newest Chairperson/Members, adjudication and settlement orders (from ${sebi.from}).` : "SEBI orders: the SEBI website could not be reached.",
    filingsOk ? `Exchange filings: ${filings.length} announcements from .data/filings.json.` : "Exchange filings: NSE and BSE block automated access; add announcements to .data/filings.json to include them.",
    "News: Google News headlines naming each company, last 180 days (supporting evidence only).",
    "Company calendar: results and ex-dividend dates via Yahoo Finance.",
  ];
  return { reports, summary: { coverage, sebiFrom: sebi.from, sample: o.demo } };
}
