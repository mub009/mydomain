/**
 * Black Points Analyst: downside-risk investigation for every stock that
 * passed the Momentum Agent's (swing) or Trend Agent's (positional) scan.
 * Reports to the Research Agent; sends its report to the Decision Agent.
 *
 * Checks
 *  Structural decline   revenue falling year after year; headlines about the
 *                       product being replaced or demand shrinking
 *  Sector pressure      only sector-wide when industry data (weak sector index
 *                       or falling peer revenue) AND disclosures from at least
 *                       two companies (falling revenue or margins in their
 *                       results, or pressure headlines) agree
 *  Company weakness     debt repayment stress, poor cash flow, losing share to
 *                       peers, customer losses, repeated project delays
 *  Governance & events  auditor resignation, adverse audit opinion, regulatory
 *                       orders (SEBI orders read directly), exchange
 *                       surveillance, scheduled events in the holding period
 *
 * Verification
 *  verified     backed by a primary source: exchange filing, SEBI order,
 *               company financial statements, exchange surveillance list or
 *               sector index data
 *  unverified   headlines only
 *  conflicting  headlines contradicted by the company's own figures
 *  stale / missing  the primary data is too old or could not be loaded
 *
 * Status per holding period: a verified material finding = Excluded; an
 * unverified, conflicting, stale or missing material finding = Needs Review;
 * otherwise Eligible. "Watch" findings are reported but don't change status.
 */
import { computeRatios } from "../company/quality";
import type { YearFinancials } from "../company/types";
import type { Analysis, BPCategory, BPEvidence, BPFinding, BPReport, BPStatus, HoldingPeriod } from "../types";
import { cleanName, type Filing, type NewsHit, type Profile, type SebiOrder } from "./sources";

export const WINDOW_DAYS: Record<HoldingPeriod, number> = { swing: 14, positional: 35 };
export const PERIOD_LABEL: Record<HoldingPeriod, string> = { swing: "Swing 1-10 days", positional: "Positional ~1 month" };
const FINANCIAL = new Set(["Banks", "Financials"]);
const FIN_SOURCE = "Company annual reports (via Yahoo Finance)";

interface Rule { category: BPCategory; flag: string; re: RegExp; minHits?: number; sector?: boolean }
export const RULES: Rule[] = [
  { category: "Governance & events", flag: "Auditor resignation", re: /auditor[^.]{0,40}resign|resignation of (the )?(statutory |joint )?auditor/i },
  { category: "Governance & events", flag: "Adverse audit finding", re: /qualified (audit )?opinion|adverse opinion|disclaimer of opinion|modified (audit )?opinion|material uncertainty|going concern doubt|emphasis of matter/i },
  { category: "Governance & events", flag: "Regulatory order or probe", re: /\bsebi\b[^.]{0,40}(order|bars?|bans?|penalt|show[- ]cause|probe|impounds?)|\b(ed|cbi|income[- ]tax|gst|dgftr?)\b[^.]{0,25}(raids?|search(es)?|probe|summons|notice)|\bnclt\b[^.]{0,40}(insolvency|cirp|admits?|petition|plea against)|insolvency (plea|proceedings|petition)|rbi[^.]{0,30}(penalt|curbs?|restricts?|bars?)|\bcci\b[^.]{0,30}(penalt|order|probe)/i },
  { category: "Company weakness", flag: "Debt repayment stress", re: /default(ed|s|ing)? on (its |the )?(loans?|debt|bonds?|interest|ncds?|dues|repayments?|payments?)|delay(s|ed)?( in)? (interest |debt |loan |bond )?(re)?payments?|missed (an? )?(interest|coupon|loan|debt) payments?|rating (downgrade|cut)|downgrades? (its |the )?(credit )?rating|debt restructuring/i },
  { category: "Company weakness", flag: "Customer loss", re: /los(es|t|ing) (a |its |key |major |biggest )?(contract|order|customer|client)|(contracts?|orders?) (cancel|terminat)|cancell?ation of (the )?(contract|order)/i },
  { category: "Company weakness", flag: "Repeated project delays", re: /(project|plant|commission\w*|capacity|expansion|launch)[^.]{0,40}(delay|deferr|postpon|pushed back|behind schedule)|(delay|deferr|postpon)\w*[^.]{0,30}(project|plant|commission|launch)/i, minHits: 2 },
  { category: "Structural decline", flag: "Shrinking demand or product being replaced", re: /obsolete|phas(e|ing)[- ]out|being replaced|replac(ed|ing) by|structural decline|demand (slump|collapse|decline)|declining demand|sales (slump|plunge)|losing (market )?share/i },
  { category: "Sector pressure", flag: "Sector pressure", re: /oversupply|\bglut\b|price war|price cuts?|falling (prices|realisations?|realizations?)|(input|raw[- ]material|fuel) costs? (rise|surge|jump|spike)|margin pressure|anti[- ]dumping|export ban|import duty|regulatory (curbs?|change)/i, sector: true },
];

export interface StockEvidence {
  years: YearFinancials[];
  profile: Profile | null;
  news: NewsHit[] | null;
  filings: Filing[];
  sebi: SebiOrder[];
}

export interface BPContext {
  today: string;
  sample: boolean;
  sebiOk: boolean;
  filingsOk: boolean;
  strict: boolean;
  sectorOf: (s: string) => string;
  /** Sector index / composite state from the sector check. */
  sectors: { sector: string; state: string; ret3m: number; sourceLabel?: string }[];
  /** Latest-year revenue growth and net-margin change for every stock in the run with financials. */
  peers: Record<string, { revYoY?: number; marginChange?: number; date?: string }>;
  /** Sector-pressure headlines by sector: which companies they came from. */
  sectorNews: Record<string, { symbol: string; hit: NewsHit }[]>;
}

const fyEnd = (label: string) => { const m = /FY(\d{2})/.exec(label); return m ? `20${m[1]}-03-31` : undefined; };
const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400_000;
const pct = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n * 10) / 10}%`;

/** Latest-year revenue growth and margin change, used for peers and sector checks. */
export function peerStats(years: YearFinancials[]) {
  const y = years[years.length - 1], p = years[years.length - 2];
  if (!y || !p) return {};
  const revYoY = y.revenue && p.revenue && p.revenue > 0 ? (y.revenue / p.revenue - 1) * 100 : undefined;
  const m = (x: YearFinancials) => (x.netIncome !== undefined && x.revenue ? (x.netIncome / x.revenue) * 100 : undefined);
  const my = m(y), mp = m(p);
  return { revYoY, marginChange: my !== undefined && mp !== undefined ? my - mp : undefined, date: fyEnd(y.year) };
}

function statusOf(findings: BPFinding[], periods: HoldingPeriod[]): Partial<Record<HoldingPeriod, BPStatus>> {
  const out: Partial<Record<HoldingPeriod, BPStatus>> = {};
  for (const p of periods) {
    const hits = findings.filter((f) => f.materiality === "material" && f.impact[p]);
    out[p] = hits.some((f) => f.impact[p] === "Excluded") ? "Excluded" : hits.some((f) => f.impact[p] === "Needs Review") ? "Needs Review" : "Eligible";
  }
  return out;
}

function finding(f: Omit<BPFinding, "impact">, periods: HoldingPeriod[]): BPFinding {
  const s: BPStatus = f.materiality !== "material" ? "Eligible" : f.verification === "verified" ? "Excluded" : "Needs Review";
  return { ...f, impact: Object.fromEntries(periods.map((p) => [p, s])) };
}

export function investigate(row: Analysis, ev: StockEvidence, ctx: BPContext, onRequest = false): BPReport {
  const periods: HoldingPeriod[] = [];
  const passed: BPReport["passed"] = {};
  if (row.lotappi >= 60) { periods.push("swing"); passed.swing = `Momentum Agent scored it ${row.lotappi.toFixed(0)}: ${row.lotReasons.slice(0, 2).join("; ") || "short-term momentum"}`; }
  if (row.mayavi >= 60) { periods.push("positional"); passed.positional = `Trend Agent scored it ${row.mayavi.toFixed(0)}: ${row.mayReasons.slice(0, 2).join("; ") || "1-month trend"}`; }
  // Searched stock that passed neither scan: checked on request for both periods.
  if (onRequest && !periods.length) {
    periods.push("swing", "positional");
    passed.swing = `Did not pass the Momentum scan (score ${row.lotappi.toFixed(0)}); checked because you searched for it`;
    passed.positional = `Did not pass the Trend scan (score ${row.mayavi.toFixed(0)}); checked because you searched for it`;
  }
  const sector = ctx.sectorOf(row.symbol);
  const financial = FINANCIAL.has(sector);
  const findings: BPFinding[] = [];
  const add = (f: Omit<BPFinding, "impact">, only?: HoldingPeriod[]) => findings.push(finding(f, only ?? periods));
  const y = ev.years, last = y[y.length - 1];
  const finDate = last ? fyEnd(last.year) : undefined;

  // ---------- evidence coverage ----------
  if (!y.length) {
    add({ category: "Evidence coverage", flag: "Financial statements unavailable", scope: "Company", materiality: "material", verification: "missing",
      evidence: [{ summary: "Annual statements could not be loaded, so debt, cash flow and revenue trends can't be checked.", source: FIN_SOURCE, kind: "company financials" }],
      note: "Held for review until the financial checks can run." });
  } else if (finDate && daysBetween(finDate, ctx.today) > 548) {
    add({ category: "Evidence coverage", flag: "Financial statements are stale", scope: "Company", materiality: "material", verification: "stale",
      evidence: [{ summary: `Latest annual statements are for ${last.year}, more than 18 months old.`, date: finDate, source: FIN_SOURCE, kind: "company financials" }],
      note: "Held for review until newer results are available." });
  }
  if (ev.news === null) {
    add({ category: "Evidence coverage", flag: "News check unavailable", scope: "Company", materiality: ctx.strict ? "material" : "watch", verification: "missing",
      evidence: [{ summary: "Google News could not be reached for this company.", source: "Google News", kind: "news" }], note: "Headline-based checks were skipped." });
  }

  // ---------- company figures (primary) ----------
  const r = y.length ? computeRatios(y) : null;
  const finEv = (summary: string): BPEvidence => ({ summary, date: finDate, source: FIN_SOURCE, kind: "company financials" });
  const revs = y.map((x) => x.revenue).filter((v): v is number => v !== undefined && v > 0);
  const ps = peerStats(y);
  // Banks, NBFCs and insurers: reported revenue swings with interest rates and investment gains, so it isn't read as demand.
  if (!financial && revs.length >= 3 && revs[revs.length - 1] < revs[revs.length - 2] && revs[revs.length - 2] < revs[revs.length - 3]) {
    add({ category: "Structural decline", flag: "Revenue falling two years in a row", scope: "Company", materiality: "material", verification: "verified",
      evidence: [finEv(`Revenue ₹${Math.round(revs[revs.length - 3]).toLocaleString("en-IN")} Cr → ₹${Math.round(revs[revs.length - 2]).toLocaleString("en-IN")} Cr → ₹${Math.round(revs[revs.length - 1]).toLocaleString("en-IN")} Cr over the last three years.`)],
      note: "Shrinking demand for what the company sells; a short-term rally doesn't change the trend." });
  } else if (!financial && ps.revYoY !== undefined && ps.revYoY < -10) {
    add({ category: "Structural decline", flag: "Revenue fell sharply last year", scope: "Company", materiality: "watch", verification: "verified",
      evidence: [finEv(`Revenue ${pct(ps.revYoY)} in ${last.year}.`)], note: "One weak year; watch the next results." });
  }
  if (r && !financial) {
    const strained = (r.interestCover !== undefined && r.interestCover < 2);
    if (r.debtToEquity !== undefined && r.debtToEquity > 1.5 && strained) {
      add({ category: "Company weakness", flag: "Debt repayment stress", scope: "Company", materiality: "material", verification: "verified",
        evidence: [finEv(`Debt/equity ${r.debtToEquity.toFixed(2)}, interest cover ${r.interestCover?.toFixed(1) ?? "n/a"}x, current ratio ${r.currentRatio?.toFixed(2) ?? "n/a"}.`)],
        note: "High debt with thin cover for interest or short-term bills." });
    } else if (r.debtToEquity !== undefined && r.debtToEquity > 1 && r.interestCover !== undefined && r.interestCover < 3) {
      add({ category: "Company weakness", flag: "Elevated debt", scope: "Company", materiality: "watch", verification: "verified",
        evidence: [finEv(`Debt/equity ${r.debtToEquity.toFixed(2)}, interest cover ${r.interestCover.toFixed(1)}x${r.currentRatio !== undefined ? `, current ratio ${r.currentRatio.toFixed(2)}` : ""}.`)], note: "Not stressed yet; sensitive to rates and a weak quarter." });
    }
    // Poor cash conversion alone can come from working capital or a consolidated lending arm;
    // it is material only together with balance-sheet strain.
    // (Debt/equity alone isn't used: group accounts carry their lending arms' debt.)
    const balanceStrain = r.interestCover !== undefined && r.interestCover < 3;
    const cfos = y.slice(-3).map((x) => x.operatingCashFlow).filter((v): v is number => v !== undefined);
    const negCfo = cfos.filter((v) => v < 0).length;
    if (negCfo >= 2 || (r.cashConversion !== undefined && r.cashConversion < 0.5)) {
      add({ category: "Company weakness", flag: "Poor cash flow", scope: "Company", materiality: balanceStrain ? "material" : "watch", verification: "verified",
        evidence: [finEv((negCfo >= 2 ? `Operating cash flow negative in ${negCfo} of the last ${cfos.length} years.` : `Only ${Math.round((r.cashConversion ?? 0) * 100)}% of 3-year profit came in as operating cash.`) +
          ` Interest cover ${r.interestCover?.toFixed(1) ?? "n/a"}x, debt/equity ${r.debtToEquity?.toFixed(2) ?? "n/a"}.`)],
        note: balanceStrain ? "Profit is not turning into cash and the balance sheet is already strained." : "Profit is not turning into cash. Group accounts with a lending arm or heavy working capital can cause this; watch it, but it isn't a red flag on its own." });
    } else if (r.cashConversion !== undefined && r.cashConversion < 0.7) {
      add({ category: "Company weakness", flag: "Weak cash conversion", scope: "Company", materiality: "watch", verification: "verified",
        evidence: [finEv(`${Math.round(r.cashConversion * 100)}% of 3-year profit came in as cash.`)], note: "Check receivables and inventory." });
    }
  }
  // losing share: revenue growth far below sector peers
  const peerG = Object.entries(ctx.peers).filter(([s, p]) => s !== row.symbol && ctx.sectorOf(s) === sector && p.revYoY !== undefined).map(([, p]) => p.revYoY!);
  if (!financial && ps.revYoY !== undefined && peerG.length >= 2) {
    const med = [...peerG].sort((a, b) => a - b)[Math.floor(peerG.length / 2)];
    if (ps.revYoY < 0 && ps.revYoY < med - 15) {
      add({ category: "Company weakness", flag: "Losing market share to peers", scope: "Company", materiality: "watch", verification: "verified",
        evidence: [finEv(`Revenue ${pct(ps.revYoY)} last year vs a ${pct(med)} median for ${peerG.length} ${sector} peers in this run.`)], note: "Peers grew while this company shrank." });
    }
  }

  // ---------- headlines, filings and SEBI orders ----------
  const name = cleanName(ev.profile?.name ?? row.symbol);
  for (const rule of RULES.filter((x) => !x.sector)) {
    const news = (ev.news ?? []).filter((n) => rule.re.test(n.title));
    const files = ev.filings.filter((f) => rule.re.test(f.title));
    const orders = rule.flag === "Regulatory order or probe" ? ev.sebi : [];
    if (news.length < (rule.minHits ?? 1) && !files.length && !orders.length) continue;
    const evidence: BPEvidence[] = [
      ...files.map((f) => ({ summary: f.title, date: f.date, source: f.source ?? "Exchange filing", url: f.url, kind: "exchange filing" as const })),
      ...orders.map((o) => ({ summary: o.title, date: o.date, source: "SEBI order", url: o.url, kind: "regulator" as const })),
      ...news.slice(0, 3).map((n) => ({ summary: n.title, date: n.date, source: n.source, url: n.url, kind: "news" as const })),
    ];
    let verification: BPFinding["verification"] = files.length || orders.length ? "verified" : "unverified";
    let note = verification === "verified" ? "Confirmed by a primary source." : "Reported in the news only; not yet confirmed by a filing or regulator.";
    // headlines contradicted by the company's own figures
    if (verification === "unverified" && rule.flag === "Debt repayment stress" && last && (last.debt ?? 0) < (last.cash ?? 0) && (r?.interestCover ?? 0) > 5) {
      verification = "conflicting"; note = `Headlines suggest repayment trouble, but the latest statements show more cash than debt and ${r!.interestCover!.toFixed(1)}x interest cover.`;
      evidence.push(finEv(`Debt ₹${last.debt} Cr vs cash ₹${last.cash} Cr.`));
    }
    if (verification === "unverified" && rule.flag.startsWith("Shrinking demand") && ps.revYoY !== undefined && ps.revYoY > 10) {
      verification = "conflicting"; note = `Headlines describe falling demand, but revenue grew ${pct(ps.revYoY)} last year.`;
      evidence.push(finEv(`Revenue ${pct(ps.revYoY)} in ${last.year}.`));
    }
    add({ category: rule.category, flag: rule.flag, scope: "Company", materiality: "material", verification, evidence, note });
  }

  // ---------- exchange surveillance and pledges (from the Red Flag Agent) ----------
  for (const f of row.desk?.redFlags.flags ?? []) {
    if (f.status !== "severe" || f.check === "Default risk") continue;
    add({ category: "Governance & events", flag: f.check === "Unsolicited tips" ? "Named in an unsolicited-tip alert" : f.check === "Promoter pledge" ? "Heavy promoter pledge" : `Under exchange surveillance (${f.check})`,
      scope: "Company", materiality: "material", verification: "verified",
      evidence: [{ summary: f.detail, source: row.desk?.source ?? "Exchange surveillance list", kind: "exchange filing" }], note: "From the exchange lists checked by the Red Flag Agent." });
  }

  // ---------- events inside each holding period ----------
  const events: { what: string; date?: string; estimate?: boolean }[] = [
    { what: "Quarterly results", date: ev.profile?.earningsDate, estimate: ev.profile?.earningsEstimate },
    { what: "Ex-dividend date", date: ev.profile?.exDividendDate },
  ];
  for (const e of events) {
    if (!e.date) continue;
    const d = daysBetween(ctx.today, e.date);
    if (d < 0) continue;
    const hit = periods.filter((p) => d <= WINDOW_DAYS[p]);
    if (!hit.length) continue;
    add({ category: "Governance & events", flag: `${e.what} on ${e.date}${e.estimate ? " (estimated)" : ""}`, scope: "Company", materiality: "watch",
      verification: e.estimate ? "unverified" : "verified",
      evidence: [{ summary: `${e.what} expected ${e.date}, ${Math.round(d)} days from now.`, date: e.date, source: "Company calendar (via Yahoo Finance)", kind: "market data" }],
      note: e.what === "Quarterly results" ? "The price can gap on results; size the position for that." : "The price drops by about the dividend on the ex-date." }, hit);
  }

  // ---------- sector pressure (sector-wide only with industry data AND several companies) ----------
  const sv = ctx.sectors.find((s) => s.sector === sector);
  const sectorPeers = Object.entries(ctx.peers).filter(([s]) => ctx.sectorOf(s) === sector);
  const weakPeers = sectorPeers.filter(([, p]) => (p.revYoY !== undefined && p.revYoY < 0) || (p.marginChange !== undefined && p.marginChange < -3));
  const peerMedian = (() => { const g = sectorPeers.map(([, p]) => p.revYoY).filter((v): v is number => v !== undefined).sort((a, b) => a - b); return g.length >= 3 ? g[Math.floor(g.length / 2)] : undefined; })();
  const industryWeak = (sv && (sv.state === "Lagging" || sv.state === "Weakening") && sv.ret3m < -5) || (peerMedian !== undefined && peerMedian < -5);
  const newsCos = [...new Set((ctx.sectorNews[sector] ?? []).map((x) => x.symbol))];
  if (industryWeak && (weakPeers.length >= 2 || newsCos.length >= 2)) {
    const evidence: BPEvidence[] = [];
    if (sv) evidence.push({ summary: `${sector} is ${sv.state.toLowerCase()}: ${pct(sv.ret3m)} over 3 months.`, source: sv.sourceLabel ?? "Sector index", kind: "industry data" });
    if (peerMedian !== undefined) evidence.push({ summary: `Median revenue growth of ${sectorPeers.length} ${sector} companies in this run: ${pct(peerMedian)}.`, source: FIN_SOURCE, kind: "industry data" });
    for (const [s, p] of weakPeers.slice(0, 4)) evidence.push({ summary: `${s}: revenue ${p.revYoY !== undefined ? pct(p.revYoY) : "n/a"}, net margin ${p.marginChange !== undefined ? pct(p.marginChange) + " pts" : "n/a"} in its latest annual results.`, date: p.date, source: FIN_SOURCE, kind: "company financials" });
    for (const x of (ctx.sectorNews[sector] ?? []).slice(0, 3)) evidence.push({ summary: `${x.symbol}: ${x.hit.title}`, date: x.hit.date, source: x.hit.source, url: x.hit.url, kind: "news" });
    add({ category: "Sector pressure", flag: `${sector} sector under pressure`, scope: "Sector", materiality: "material",
      verification: weakPeers.length >= 2 ? "verified" : "unverified", evidence,
      note: weakPeers.length >= 2 ? `Industry data and the results of ${weakPeers.length} ${sector} companies agree.` : "Industry data is weak and several companies are in the news for it, but their results don't confirm it yet." });
  }

  return {
    symbol: row.symbol, sector, subsector: ev.profile?.industry, company: ev.profile?.name, passed, findings,
    status: statusOf(findings, periods), checkedAt: ctx.today, sample: ctx.sample,
  };
}

/** Stocks the analyst checks: anything that passed either scan. */
export const passedScan = (r: Analysis) => r.lotappi >= 60 || r.mayavi >= 60;
