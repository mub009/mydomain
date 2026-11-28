"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CompanyProfile, CompanyReport, PeerRow, Quality, QualityCheck, Ratios, YearFinancials } from "@/lib/company/types";
import { Segmented } from "@/components/ui/segmented";
import type { Decision } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDesk, useStockResult } from "@/store/desk";
import { AgentAvatar } from "./agent-avatar";
import { CapTag, EpsGrowth } from "./fundamentals";
import { VerdictBadge } from "./primitives";

/** ₹ crore with two decimals, Indian digit grouping. */
const cr2 = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const crore = (n?: number) => (n === undefined ? "–" : `₹${cr2(n)} Cr`);
const GRADE_STYLE: Record<Quality["grade"], string> = {
  A: "bg-[var(--strong-bg)] text-[var(--strong-fg)]", B: "bg-[var(--buy-bg)] text-[var(--buy-fg)]",
  C: "bg-[var(--watch-bg)] text-[var(--watch-fg)]", D: "bg-[var(--avoid-bg)] text-[var(--avoid-fg)]", "n/a": "bg-muted text-muted-foreground",
};
const CHECK_STYLE: Record<QualityCheck["verdict"], string> = { good: "text-pos", ok: "text-foreground", weak: "text-neg", "n/a": "text-muted-foreground" };

export function GradeTag({ grade, className }: { grade: Quality["grade"]; className?: string }) {
  return <span className={cn("inline-grid min-w-6 place-items-center rounded-md px-1.5 text-[11px] font-black", GRADE_STYLE[grade], className)} title={`Quality grade ${grade}`}>{grade}</span>;
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2"><h3 className="text-[13px] font-semibold">{title}</h3>{right}</div>
      {children}
    </section>
  );
}

type Key = keyof YearFinancials;
type Row = { label: string; key?: Key; calc?: (y: YearFinancials, all: YearFinancials[]) => number | undefined; fmt?: "cr" | "rs" | "pct" | "ratio"; strong?: boolean };

/** One statement as a table: periods across, items down; rows with no data at all are left out. */
function StatementTable({ periods, rows, label }: { periods: YearFinancials[]; rows: Row[]; label: string }) {
  const value = (r: Row, i: number) => (r.calc ? r.calc(periods[i], periods) : (periods[i][r.key!] as number | undefined));
  const shown = rows.filter((r) => periods.some((_, i) => value(r, i) !== undefined));
  const show = (r: Row, v: number | undefined) => v === undefined ? "–" : r.fmt === "pct" ? `${v >= 0 && r.label.includes("growth") ? "+" : ""}${v.toFixed(1)}%` : r.fmt === "rs" ? `₹${v.toFixed(2)}` : r.fmt === "ratio" ? v.toFixed(2) : cr2(v);
  // Start scrolled to the newest period (on the right) when the table is wider than the panel.
  const box = useRef<HTMLDivElement>(null);
  const cols = periods.map((p) => p.year).join(",");
  useEffect(() => { const el = box.current; if (el) el.scrollLeft = el.scrollWidth; }, [cols]);
  return (
    <div ref={box} className="-mx-1 overflow-x-auto scroll-thin">
      <table className="w-full text-[12px] tnum" aria-label={label}>
        <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground"><th className="sticky left-0 z-[1] border-r border-[var(--edge)] bg-card px-1 py-1 text-left font-semibold">Item</th>
          {periods.map((y) => <th key={y.year} className="whitespace-nowrap py-1 pl-3 pr-1 text-right font-semibold" title={y.date}>{y.year}</th>)}</tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.label} className={cn("border-t", r.strong && "font-semibold")}><td className={cn("sticky left-0 z-[1] min-w-[7.5rem] max-w-[9.5rem] border-r border-[var(--edge)] bg-card px-1 py-1 pr-2 leading-snug sm:max-w-none sm:whitespace-nowrap", r.strong ? "text-foreground" : "text-muted-foreground")}>{r.label}</td>
              {periods.map((y, i) => { const v = value(r, i); return <td key={y.year} className={cn("whitespace-nowrap py-1 pl-3 pr-1 text-right", v !== undefined && v < 0 && "text-neg")}>{show(r, v)}</td>; })}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const pctOf = (a?: number, b?: number) => (a !== undefined && b ? (a / b) * 100 : undefined);
const growth = (a?: number, b?: number) => (a !== undefined && b && b > 0 ? (a / b - 1) * 100 : undefined);
/** The same period a year earlier (same month), if we have it: last year for annual, the same quarter last year for quarterly. */
const yearAgo = (y: YearFinancials, all: YearFinancials[]) => {
  if (!y.date) return undefined;
  const want = `${Number(y.date.slice(0, 4)) - 1}${y.date.slice(4, 7)}`;
  return all.find((p) => p.date?.slice(0, 7) === want);
};

const INCOME_ROWS = (quarterly: boolean): Row[] => [
  { label: "Revenue", key: "revenue", strong: true },
  { label: quarterly ? "Revenue growth (vs same quarter last year)" : "Revenue growth (vs last year)", calc: (y, all) => growth(y.revenue, yearAgo(y, all)?.revenue), fmt: "pct" },
  { label: "Interest income", key: "interestIncome" },
  { label: "Net interest income", key: "netInterestIncome" },
  { label: "Fees & other income", key: "otherIncome" },
  { label: "Cost of revenue", key: "costOfRevenue" },
  { label: "Gross profit", key: "grossProfit" },
  { label: "Operating expenses", key: "operatingExpense" },
  { label: "Total expenses", key: "totalExpenses" },
  { label: "EBITDA", key: "ebitda" },
  { label: "Depreciation", key: "depreciation" },
  { label: "Operating profit", calc: (y) => y.operatingIncome ?? y.ebit },
  { label: "Operating margin", calc: (y) => pctOf(y.operatingIncome ?? y.ebit, y.revenue), fmt: "pct" },
  { label: "Interest paid", key: "interestExpense" },
  { label: "Profit before tax", key: "pretaxIncome" },
  { label: "Tax", key: "tax" },
  { label: "Tax rate", calc: (y) => pctOf(y.tax, y.pretaxIncome), fmt: "pct" },
  { label: "Minority interest", key: "minorityInterests" },
  { label: "Net profit", key: "netIncome", strong: true },
  { label: "Net margin", calc: (y) => pctOf(y.netIncome, y.revenue), fmt: "pct" },
  { label: quarterly ? "Profit growth (vs same quarter last year)" : "Profit growth (vs last year)", calc: (y, all) => growth(y.netIncome, yearAgo(y, all)?.netIncome), fmt: "pct" },
  { label: "EPS (₹ per share)", key: "eps", fmt: "rs", strong: true },
];

const BALANCE_ROWS: Row[] = [
  { label: "Total assets", key: "totalAssets", strong: true },
  { label: "Fixed assets (net)", key: "netPPE" }, { label: "Goodwill", key: "goodwill" }, { label: "Inventory", key: "inventory" },
  { label: "Receivables", key: "receivables" }, { label: "Cash", key: "cash" }, { label: "Current assets", key: "currentAssets" },
  { label: "Total liabilities", key: "totalLiabilities", strong: true }, { label: "Current liabilities", key: "currentLiabilities" },
  { label: "Total debt", key: "debt" }, { label: "Net debt", key: "netDebt" },
  { label: "Shareholders’ equity", key: "equity", strong: true }, { label: "Retained earnings", key: "retainedEarnings" },
  { label: "Minority interest", key: "minorityInterest" }, { label: "Working capital", key: "workingCapital" },
  { label: "Shares issued (Cr)", key: "shares" },
  { label: "Book value per share (₹)", calc: (y) => (y.equity !== undefined && y.shares ? y.equity / y.shares : undefined), fmt: "rs" },
  { label: "Debt / equity", calc: (y) => (y.debt !== undefined && y.equity ? y.debt / y.equity : undefined), fmt: "ratio" },
  { label: "Current ratio", calc: (y) => (y.currentAssets !== undefined && y.currentLiabilities ? y.currentAssets / y.currentLiabilities : undefined), fmt: "ratio" },
];

const CASH_ROWS: Row[] = [
  { label: "Cash from operating activities", key: "operatingCashFlow", strong: true },
  { label: "Cash from investing activities", key: "investingCashFlow", strong: true },
  { label: "Cash from financing activities", key: "financingCashFlow", strong: true },
  { label: "Net change in cash", key: "netChangeInCash", strong: true },
  { label: "Changes in working capital", key: "changeInWorkingCapital" },
  { label: "Capital expenditures", key: "capex" },
  { label: "Free cash flow", key: "freeCashFlow", strong: true },
  { label: "Dividends paid", key: "dividendsPaid" }, { label: "Debt raised", key: "debtIssued" }, { label: "Debt repaid", key: "debtRepaid" },
  { label: "Cash at end of period", key: "endCash" }, { label: "Net profit", key: "netIncome" },
  { label: "Cash flow ÷ profit", calc: (y) => pctOf(y.operatingCashFlow, y.netIncome), fmt: "pct" },
];

const has = (ps: YearFinancials[], ks: Key[]) => ps.some((p) => ks.some((k) => p[k] !== undefined));

/** Company summary: what the company does, who runs it, and its key numbers. */
function ProfileSection({ p, price }: { p: CompanyProfile; price: number }) {
  const [more, setMore] = useState(false);
  const s = p.stats;
  const num = (v: number | undefined, f: (v: number) => string) => (v === undefined ? "–" : f(v));
  const rs = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const pc = (v: number) => `${v.toFixed(2)}%`;
  const range = s.high52 && s.low52 ? Math.max(0, Math.min(100, ((price - s.low52) / (s.high52 - s.low52)) * 100)) : undefined;
  const stats: [string, string][] = [
    ["Market cap", num(s.marketCapCr, (v) => `₹${v.toLocaleString("en-IN")} Cr`)],
    ["P/E (TTM)", num(s.pe, (v) => v.toFixed(2))], ["Forward P/E", num(s.forwardPe, (v) => v.toFixed(2))],
    ["P/B", num(s.pb, (v) => v.toFixed(2))], ["EPS (TTM)", num(s.eps, rs)], ["Book value / share", num(s.bookValue, rs)],
    ["Dividend yield", num(s.dividendYield, pc)], ["ROE", num(s.roe, pc)], ["Profit margin", num(s.profitMargin, pc)],
    ["Revenue growth (YoY)", num(s.revenueGrowth, pc)], ["Profit growth (YoY)", num(s.earningsGrowth, pc)], ["Debt / equity", num(s.debtToEquity, (v) => v.toFixed(2))],
    ["Beta", num(s.beta, (v) => v.toFixed(2))], ["Avg. volume", num(s.avgVolume, (v) => v.toLocaleString("en-IN"))],
  ];
  return (
    <Section title="Company summary">
      <div>
        <b className="block text-[14px]">{p.name}</b>
        <span className="text-[12px] text-muted-foreground">{[p.sector, p.industry].filter(Boolean).join(" · ")}{p.city ? ` · ${p.city}` : ""}{p.employees ? ` · ${p.employees.toLocaleString("en-IN")} employees` : ""}</span>
      </div>
      {p.about && (
        <div>
          <p className={cn("text-[12.5px] leading-relaxed", !more && "line-clamp-4")}>{p.about}</p>
          {p.about.length > 280 && <button type="button" onClick={() => setMore((v) => !v)} className="text-[12px] font-semibold text-primary hover:underline">{more ? "Show less" : "Read more"}</button>}
        </div>
      )}
      {range !== undefined && (
        <div className="space-y-1" aria-label="52-week range">
          <div className="flex justify-between text-[11px] text-muted-foreground tnum"><span>52-week low {rs(s.low52!)}</span><span>high {rs(s.high52!)}</span></div>
          <div className="relative h-1.5 rounded-full bg-muted"><span className="absolute -top-[3px] size-3 -translate-x-1/2 rounded-full bg-primary ring-2 ring-card" style={{ left: `${range}%` }} title={`Now ${rs(price)}`} /></div>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] tnum sm:grid-cols-3">
        {stats.map(([l, v]) => <div key={l} className="flex justify-between gap-2 border-b border-[var(--edge)] py-1"><dt className="text-muted-foreground">{l}</dt><dd className="font-semibold">{v}</dd></div>)}
      </dl>
      {p.people.length > 0 && (
        <p className="text-[12px] text-muted-foreground"><b className="font-semibold text-foreground">Key people:</b> {p.people.map((x) => `${x.name}${x.title ? ` (${x.title})` : ""}`).join(" · ")}</p>
      )}
      <p className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
        {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">Company website<ExternalLink className="size-3" /></a>}
        <span>{p.source}; figures can lag the latest results.</span>
      </p>
    </Section>
  );
}

const cache = new Map<string, { report: CompanyReport; peers: PeerRow[] }>();

export function CompanyTab({ d }: { d: Decision }) {
  const result = useStockResult();
  const openStock = useDesk((s) => s.openStock);
  const demo = result?.source.kind === "demo";
  const seed = result?.source.seed ?? 0;

  // Peers: same sector in this run, closest in market cap.
  const peers = useMemo(() => {
    if (!result) return [];
    const cap = d.fundamentals?.marketCapCr ?? 0;
    return result.all.filter((x) => x.symbol !== d.symbol && x.sector === d.sector && d.sector !== "Other")
      .sort((a, b) => Math.abs((a.fundamentals?.marketCapCr ?? 0) - cap) - Math.abs((b.fundamentals?.marketCapCr ?? 0) - cap)).slice(0, 5);
  }, [result, d]);

  const key = `${d.symbol}:${demo}:${seed}:${peers.map((p) => p.symbol).join(",")}`;
  const [data, setData] = useState(cache.get(key) ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [period, setPeriod] = useState<"annual" | "quarterly">("annual");
  useEffect(() => {
    if (cache.has(key)) { setData(cache.get(key)!); return; }
    setData(null); setErr(null);
    const q = new URLSearchParams({ symbol: d.symbol, price: String(d.entry), demo: demo ? "1" : "0", seed: String(seed),
      peers: peers.map((p) => `${p.symbol}:${p.entry}`).join(",") });
    let alive = true;
    fetch(`/api/company?${q}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Error ${r.status}`))))
      .then((j) => { cache.set(key, j); if (alive) setData(j); })
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [key, d.symbol, d.entry, demo, seed, peers]);

  if (err) return <p className="px-5 py-8 text-sm text-neg">Could not load company data: {err}</p>;
  if (!data) return <p className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading the company summary, statements and shareholders…</p>;

  const { report: r, peers: peerData } = data;
  const peerBy = new Map(peerData.map((p) => [p.symbol, p]));
  const rows: { d: Decision; ratios?: Ratios; grade?: Quality["grade"]; self?: boolean }[] = [
    { d, ratios: r.ratios, grade: r.quality.grade, self: true },
    ...peers.map((p) => ({ d: p, ratios: peerBy.get(p.symbol)?.ratios, grade: peerBy.get(p.symbol)?.grade })),
  ];
  const pe = (x: Decision) => (x.fundamentals?.epsTTM && x.fundamentals.epsTTM > 0 ? (x.entry / x.fundamentals.epsTTM).toFixed(1) : "–");
  const fmt = (n: number | undefined, f: (n: number) => string) => (n === undefined ? "–" : f(n));
  const quarterly = period === "quarterly";
  const periods = quarterly ? r.quarters ?? [] : r.years;
  const noun = quarterly ? "quarterly" : "annual";
  // Quarterly data more than ~5 months old: newer results have probably been published.
  const lastDate = periods.at(-1)?.date;
  const stale = Boolean(lastDate && Date.now() - new Date(lastDate).getTime() > 150 * 86400000);

  return (
    <div className="space-y-4 px-5 pb-6">
      {r.sample && <p className="rounded-lg border border-warn-border bg-warn-bg px-3 py-2 text-[12px] text-warn-fg"><b>Sample figures (demo).</b> Not real financials or holders.</p>}

      {r.profile ? <ProfileSection p={r.profile} price={d.entry} /> : !r.sample && (
        <Section title="Company summary"><p className="text-[12.5px] text-muted-foreground">The company profile isn&apos;t available from our data source right now. See the company&apos;s page on NSE (link below).</p></Section>
      )}

      {/* Research Agent's quality view */}
      <Section title="Balance sheet & cash-flow quality" right={<GradeTag grade={r.quality.grade} className="h-6 min-w-7 text-sm" />}>
        <div className="flex gap-2.5 rounded-lg bg-muted/50 p-2.5">
          <AgentAvatar who="Research" size={28} />
          <p className="text-[12.5px] leading-relaxed"><b className="text-[#14B8A6]">Research Agent:</b> {r.quality.summary}</p>
        </div>
        <ul className="divide-y text-[12.5px]">
          {r.quality.checks.map((c) => (
            <li key={c.label} className="grid grid-cols-[1fr_auto] gap-x-3 py-1.5">
              <span className="font-medium">{c.label}</span>
              <span className={cn("text-right font-semibold tnum", CHECK_STYLE[c.verdict])}>{c.value}</span>
              <span className="col-span-2 text-[11.5px] text-muted-foreground">{c.note}</span>
            </li>
          ))}
        </ul>
        {r.quality.financialSector && <p className="text-[11px] text-muted-foreground">Banks and NBFCs borrow and lend as their business, so cash flow, debt and current ratio are not graded for them.</p>}
      </Section>

      {/* Peers */}
      <Section title={`Peers · ${d.sector}`} right={<span className="text-[11px] text-muted-foreground">from this run’s stock list</span>}>
        {peers.length ? (
          <div className="-mx-1 overflow-x-auto scroll-thin">
            <table className="w-full min-w-[520px] text-left text-[12px] tnum">
              <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {["Company", "Size", "P/E", "EPS 1Y", "ROE", "D/E", "Cash conv.", "Quality", "Verdict"].map((h, i) => <th key={h} className={cn("px-1 py-1 font-semibold", i > 1 && i < 7 && "text-right")}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map(({ d: x, ratios, grade, self }) => (
                  <tr key={x.symbol} onClick={() => !self && openStock(x.symbol)}
                    className={cn("border-t", self ? "bg-primary-soft/60 font-semibold" : "cursor-pointer hover:bg-muted/50")}>
                    <td className="px-1 py-1.5">{x.symbol}{self && <span className="ml-1 text-[10px] font-normal text-muted-foreground">(this)</span>}</td>
                    <td className="px-1 py-1.5">{x.fundamentals ? <CapTag cap={x.fundamentals.cap} /> : "–"}</td>
                    <td className="px-1 py-1.5 text-right">{pe(x)}</td>
                    <td className="px-1 py-1.5 text-right"><EpsGrowth f={x.fundamentals} /></td>
                    <td className="px-1 py-1.5 text-right">{fmt(ratios?.roe, (n) => `${n.toFixed(1)}%`)}</td>
                    <td className="px-1 py-1.5 text-right">{fmt(ratios?.debtToEquity, (n) => n.toFixed(2))}</td>
                    <td className="px-1 py-1.5 text-right">{fmt(ratios?.cashConversion, (n) => `${n.toFixed(2)}×`)}</td>
                    <td className="px-1 py-1.5">{grade ? <GradeTag grade={grade} /> : "–"}</td>
                    <td className="px-1 py-1.5"><VerdictBadge verdict={x.verdict} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-[12.5px] text-muted-foreground">No other {d.sector === "Other" ? "known-sector" : d.sector} stocks in this run. Choose “All caps” to compare with more companies.</p>}
      </Section>

      {/* Statements: annual or quarterly */}
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 bg-card/95 px-1 py-1.5 backdrop-blur">
        <h3 className="text-[13px] font-semibold">Financial statements</h3>
        <Segmented label="Annual or quarterly statements" value={period} onChange={setPeriod}
          options={[{ value: "annual", label: "Annual" }, { value: "quarterly", label: "Quarterly" }]} />
      </div>

      <Section title={`Income statement (₹ Cr) · ${quarterly ? "last 5 quarters" : "last 4 years"}`}>
        {has(periods, ["revenue", "netIncome", "pretaxIncome"]) ? (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
              {[["Revenue", "var(--series-2)"], ["Net profit", "var(--series-1)"]].map(([l, c]) => (
                <span key={l} className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: c }} />{l}</span>
              ))}
            </div>
            <div className="h-36" role="img" aria-label={`Revenue and net profit by ${quarterly ? "quarter" : "year"}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periods} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <YAxis width={56} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(v: number) => Math.round(v).toLocaleString("en-IN")} />
                  <ReferenceLine y={0} stroke="var(--muted-foreground)" />
                  <Tooltip isAnimationActive={false} cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    formatter={(v, n) => [crore(Number(v)), n === "revenue" ? "Revenue" : "Net profit"]}
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="revenue" fill="var(--series-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="netIncome" fill="var(--series-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <StatementTable periods={periods} rows={INCOME_ROWS(quarterly)} label={`Income statement, ${noun}`} />
            {quarterly && stale && (
              <p className="rounded-lg bg-warn-bg px-2.5 py-1.5 text-[11.5px] text-warn-fg">
                The latest quarter we have is {periods.at(-1)!.year}. Newer results may be out: check the company&apos;s financial results on NSE (link below).
              </p>
            )}
            {r.sector === "Banks" || r.sector === "Financials"
              ? <p className="text-[11px] text-muted-foreground">Banks and finance companies don&apos;t report gross profit or EBITDA; their revenue is mostly interest earned.</p> : null}
          </>
        ) : <p className="text-[12.5px] text-muted-foreground">The {noun} income statement isn&apos;t available for this stock from our data source.{quarterly ? " Try Annual." : ""} Check the company&apos;s results on NSE (link below).</p>}
      </Section>

      {/* Cash flow */}
      <Section title={`Cash flow (₹ Cr) · ${noun}`}>
        {has(periods, ["operatingCashFlow", "freeCashFlow"]) ? (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
              {[["Net profit", "var(--series-1)"], ["Operating cash flow", "var(--series-2)"], ["Free cash flow", "var(--series-3)"]].map(([l, c]) => (
                <span key={l} className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{ background: c }} />{l}</span>
              ))}
            </div>
            <div className="h-44" role="img" aria-label="Net profit, operating cash flow and free cash flow by year">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periods} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <YAxis width={56} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(v: number) => Math.round(v).toLocaleString("en-IN")} />
                  <ReferenceLine y={0} stroke="var(--muted-foreground)" />
                  <Tooltip isAnimationActive={false} cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    formatter={(v, n) => [crore(Number(v)), n === "netIncome" ? "Net profit" : n === "operatingCashFlow" ? "Operating cash flow" : "Free cash flow"]}
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="netIncome" fill="var(--series-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="operatingCashFlow" fill="var(--series-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="freeCashFlow" fill="var(--series-3)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <StatementTable periods={periods} rows={CASH_ROWS} label={`Cash flow, ${noun}`} />
            <p className="text-[11px] text-muted-foreground">Good quality: operating cash flow at or above net profit, and free cash flow (after capital spending) positive most years.</p>
          </>
        ) : <p className="text-[12.5px] text-muted-foreground">{quarterly
          ? "Indian companies publish the cash-flow statement every six months or yearly, not every quarter. Switch to Annual to see it."
          : "The cash-flow statement isn't available for this stock from our data source."}</p>}
      </Section>

      {/* Balance sheet */}
      <Section title={`Balance sheet (₹ Cr) · ${noun}`}>
        {has(periods, ["totalAssets", "equity", "debt"]) ? (
          <>
            <StatementTable periods={periods} rows={BALANCE_ROWS} label={`Balance sheet, ${noun}`} />
            {quarterly && <p className="text-[11px] text-muted-foreground">Indian companies publish the balance sheet every six months (September and March), so some quarters show “–”.</p>}
          </>
        ) : <p className="text-[12.5px] text-muted-foreground">{quarterly
          ? "No balance sheet for these quarters yet (published every six months). Switch to Annual."
          : "The balance sheet isn't available for this stock from our data source."}</p>}
      </Section>

      {/* Shareholders */}
      <Section title="Who owns it" right={r.shareholding?.asOf && <span className="text-[11px] text-muted-foreground">as of {r.shareholding.asOf}</span>}>
        {r.shareholding && r.shareholding.categories.length ? (
          <>
            <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-md" role="img"
              aria-label={r.shareholding.categories.map((c) => `${c.label} ${c.pct}%`).join(", ")}>
              {r.shareholding.categories.filter((c) => c.pct > 0).map((c, i) => (
                <span key={c.label} style={{ width: `${c.pct}%`, background: `var(--series-${i + 1})` }} title={`${c.label}: ${c.pct}%`} />
              ))}
            </div>
            <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
              {r.shareholding.categories.map((c, i) => (
                <li key={c.label} className="flex items-center gap-1.5">
                  <i className="size-2.5 shrink-0 rounded-sm" style={{ background: `var(--series-${i + 1})` }} />
                  <span className="flex-1 text-muted-foreground">{c.label}</span><b className="tnum">{c.pct.toFixed(2)}%</b>
                </li>
              ))}
            </ul>
            {r.shareholding.promoterTrend && (
              <p className="text-[12px]">
                Promoter holding, last 4 quarters: {r.shareholding.promoterTrend.map((t) => `${t.pct.toFixed(1)}%`).join(" → ")}
                {(() => { const t = r.shareholding!.promoterTrend!; const ch = t[t.length - 1].pct - t[0].pct;
                  return <b className={cn("ml-1", ch >= 0 ? "text-pos" : "text-neg")}>({ch >= 0 ? "+" : ""}{ch.toFixed(2)} pts)</b>; })()}
              </p>
            )}
            {r.shareholding.pledgedPct !== undefined && (
              <p className={cn("text-[12px]", r.shareholding.pledgedPct > 5 && "font-semibold text-neg")}>
                Promoter shares pledged: {r.shareholding.pledgedPct.toFixed(2)}%{r.shareholding.pledgedPct > 5 ? " (a risk if the price falls)" : ""}
              </p>
            )}
            {r.shareholding.top.length > 0 && (
              <table className="w-full text-[12px] tnum">
                <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground"><th className="py-1 text-left font-semibold">Largest holders</th><th className="py-1 text-left font-semibold">Type</th><th className="py-1 text-right font-semibold">Stake</th></tr></thead>
                <tbody>{r.shareholding.top.map((h) => <tr key={h.name + h.type} className="border-t"><td className="py-1">{h.name}</td><td className="py-1 text-muted-foreground">{h.type}</td><td className="py-1 text-right">{h.pct.toFixed(2)}%</td></tr>)}</tbody>
              </table>
            )}
            {r.shareholding.note && <p className="text-[11px] text-muted-foreground">{r.shareholding.note}</p>}
          </>
        ) : <p className="text-[12.5px] text-muted-foreground">Shareholding data isn’t available from the free source. Use the official NSE page below.</p>}
      </Section>

      <div className="space-y-1 text-[12px]">
        <p className="text-muted-foreground">Source: {r.source}. Check important numbers against the official filings:</p>
        {r.links.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 font-medium text-primary hover:underline">
            {l.label}<ExternalLink className="size-3" />
          </a>
        ))}
      </div>
    </div>
  );
}
